import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import { randomUUID } from "node:crypto";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { db } from "../db.js";
import { absolutePath, ensureUserDir, storagePathFor } from "../lib/storage.js";

ffmpeg.setFfmpegPath(ffmpegPath.path);
// The npm-vendored binary's postinstall (chmod +x) is gated by an
// install-script allowlist keyed to its exact version, which silently drifts
// on every dependency bump. Set the exec bit ourselves too so a missed
// approval never turns into a runtime "permission denied" instead of a
// build-time warning. No-op on Windows.
void chmod(ffmpegPath.path, 0o755).catch(() => {});

// drawtext needs a real font file — the minimal container this runs in has
// no system fonts/fontconfig, so relying on a default lookup fails with
// "No such file or directory". Bundle one instead of depending on the host.
const require = createRequire(import.meta.url);
const FONT_PATH = join(dirname(require.resolve("dejavu-fonts-ttf/package.json")), "ttf", "DejaVuSans-Bold.ttf");

const ASPECT_SIZE: Record<string, { w: number; h: number }> = {
  "9:16": { w: 720, h: 1280 },
  "16:9": { w: 1280, h: 720 },
  "1:1": { w: 1080, h: 1080 },
};

const FPS = 30;
const MAX_IMAGES = 12;
const MAX_SFX = 10;

export type SlideshowStyle = "kenburns" | "cinematic" | "vibrant" | "classic";

export interface SlideshowParams {
  imageAssetIds: string[];
  musicAssetId?: string;
  musicVolume?: number;
  soundEffects?: { assetId: string; atSec: number; volume?: number }[];
  secondsPerImage?: number;
  durations?: number[];
  aspectRatio?: "9:16" | "16:9" | "1:1";
  style?: SlideshowStyle;
  captions?: { text: string; atSec: number; durationSec: number }[];
}

async function setJob(jobId: string, data: Parameters<typeof db.job.update>[0]["data"]) {
  await db.job.update({ where: { id: jobId }, data });
}

function escapeDrawtext(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\u2019");
}

function escapeFilterPath(path: string): string {
  return path.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
}

const ESCAPED_FONT_PATH = escapeFilterPath(FONT_PATH);

// Each style is a genuinely different filter chain (motion + color), not a
// label with no effect behind it — rule: never ship a control that does
// nothing. "classic" skips zoompan entirely (static frame, hard cut) rather
// than faking stillness with a near-zero zoom rate.
function styleFilterChain(style: SlideshowStyle, w: number, h: number, frames: number, clipDur: number): string {
  const base = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`;
  const tail = `trim=duration=${clipDur.toFixed(3)},setpts=PTS-STARTPTS`;
  switch (style) {
    case "classic":
      return `${base},fps=${FPS},${tail}`;
    case "cinematic":
      return (
        `${base},zoompan=z='min(zoom+0.0008,1.08)':d=${frames}:s=${w}x${h}:fps=${FPS},` +
        `eq=saturation=0.85:contrast=1.05,vignette=PI/5,${tail}`
      );
    case "vibrant":
      return (
        `${base},zoompan=z='min(zoom+0.0022,1.25)':d=${frames}:s=${w}x${h}:fps=${FPS},` +
        `eq=saturation=1.35:contrast=1.08,${tail}`
      );
    case "kenburns":
    default:
      return `${base},zoompan=z='min(zoom+0.0012,1.15)':d=${frames}:s=${w}x${h}:fps=${FPS},${tail}`;
  }
}

export async function runSlideshowJob(jobId: string): Promise<void> {
  const job = await db.job.findUnique({ where: { id: jobId }, include: { project: true } });
  if (!job) return;

  const params = job.params as unknown as SlideshowParams;
  const workDir = await mkdtemp(join(tmpdir(), "vidora-"));

  try {
    await setJob(jobId, { status: "ANALYZING", progress: 5, statusMessage: "Checking your media" });

    const imageIds = params.imageAssetIds.slice(0, MAX_IMAGES);
    if (imageIds.length === 0) {
      throw new UserFacingError("Add at least one image to generate a video.");
    }

    const images = await db.asset.findMany({
      where: { id: { in: imageIds }, userId: job.project.userId, kind: "IMAGE" },
    });
    const orderedImages = imageIds
      .map((id) => images.find((a) => a.id === id))
      .filter((a): a is NonNullable<typeof a> => Boolean(a));
    if (orderedImages.length === 0) {
      throw new UserFacingError("Those images couldn't be found. Please re-upload and try again.");
    }

    let music: Awaited<ReturnType<typeof db.asset.findFirst>> = null;
    if (params.musicAssetId) {
      music = await db.asset.findFirst({
        where: { id: params.musicAssetId, userId: job.project.userId, kind: "AUDIO" },
      });
    }

    const requestedSfx = (params.soundEffects ?? []).slice(0, MAX_SFX);
    const sfxAssets =
      requestedSfx.length > 0
        ? await db.asset.findMany({
            where: { id: { in: requestedSfx.map((s) => s.assetId) }, userId: job.project.userId, kind: "AUDIO" },
          })
        : [];
    const soundEffects = requestedSfx
      .map((s) => ({ ...s, asset: sfxAssets.find((a) => a.id === s.assetId) }))
      .filter((s): s is typeof s & { asset: NonNullable<(typeof s)["asset"]> } => Boolean(s.asset));

    const user = await db.user.findUnique({ where: { id: job.project.userId } });
    const needsWatermark = user?.plan !== "PREMIUM";

    const size = ASPECT_SIZE[params.aspectRatio ?? "9:16"] ?? ASPECT_SIZE["9:16"];
    const style = params.style ?? "kenburns";
    const fallbackSec = Math.min(Math.max(params.secondsPerImage ?? 3, 1.5), 8);
    const clipDurations = orderedImages.map((_, i) => {
      const requested = params.durations?.[i];
      return requested && requested > 0 ? Math.min(Math.max(requested, 1), 12) : fallbackSec;
    });

    await setJob(jobId, { status: "GENERATING", progress: 15, statusMessage: "Building your scenes" });

    // Hard cuts via the `concat` filter rather than `xfade`: xfade needs
    // FFmpeg 4.3+ and the static binary this runs on (any platform) predates
    // that. concat has been stable since the 2.x line, so this renders
    // identically wherever the job runs.
    const inputs: string[] = [];
    const filters: string[] = [];

    orderedImages.forEach((img, i) => {
      inputs.push(absolutePath(img.storagePath));
      const clipDur = clipDurations[i];
      const frames = Math.round(clipDur * FPS);
      filters.push(`[${i}:v]${styleFilterChain(style, size.w, size.h, frames, clipDur)}[v${i}]`);
    });

    let videoOutLabel: string;
    if (orderedImages.length === 1) {
      videoOutLabel = "v0";
    } else {
      const concatInputs = orderedImages.map((_, i) => `[v${i}]`).join("");
      filters.push(`${concatInputs}concat=n=${orderedImages.length}:v=1:a=0[vout]`);
      videoOutLabel = "vout";
    }

    // burned-in captions
    let videoLabel = videoOutLabel;
    (params.captions ?? []).slice(0, 20).forEach((c, i) => {
      const next = `cap${i}`;
      const start = Math.max(c.atSec, 0);
      const end = start + Math.max(c.durationSec, 0.5);
      filters.push(
        `[${videoLabel}]drawtext=fontfile='${ESCAPED_FONT_PATH}':text='${escapeDrawtext(c.text)}':fontcolor=white:fontsize=${Math.round(
          size.w / 18
        )}:box=1:boxcolor=black@0.55:boxborderw=14:x=(w-text_w)/2:y=h-h/6:enable='between(t,${start},${end})'[${next}]`
      );
      videoLabel = next;
    });

    // Free-plan watermark — small, unobtrusive, but always present on a
    // non-Premium export. Applied last so nothing else can cover it.
    if (needsWatermark) {
      filters.push(
        `[${videoLabel}]drawtext=fontfile='${ESCAPED_FONT_PATH}':text='VIDORA AI':fontcolor=white@0.65:fontsize=${Math.round(
          size.w / 26
        )}:x=w-text_w-16:y=h-text_h-14[watermarked]`
      );
      videoLabel = "watermarked";
    }

    const totalDur = clipDurations.reduce((a, b) => a + b, 0);
    const outputPath = join(workDir, "output.mp4");

    await setJob(jobId, { status: "PROCESSING", progress: 45, statusMessage: "Rendering frames" });

    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg();
      inputs.forEach((path) => cmd.input(path).inputOptions(["-loop 1"]));

      // Audio: music (trimmed/faded/volumed) and any sound effects (delayed
      // to their chosen timestamp) are each normalized to a labeled track,
      // then combined with amix if there's more than one. amix in this
      // ffmpeg build always divides output level by input count (the
      // `normalize` toggle to disable that landed in later ffmpeg versions
      // than the bundled binary) — the trailing volume=N compensates.
      const audioLabels: string[] = [];
      let nextAudioInputIndex = inputs.length;

      if (music) {
        cmd.input(absolutePath(music.storagePath));
        const musicVolume = Math.min(Math.max(params.musicVolume ?? 0.9, 0), 2);
        filters.push(
          `[${nextAudioInputIndex}:a]atrim=0:${totalDur.toFixed(2)},afade=t=in:st=0:d=1,` +
            `afade=t=out:st=${Math.max(totalDur - 1.5, 0).toFixed(2)}:d=1.5,volume=${musicVolume}[music0]`
        );
        audioLabels.push("music0");
        nextAudioInputIndex += 1;
      }

      soundEffects.forEach((sfx, i) => {
        cmd.input(absolutePath(sfx.asset.storagePath));
        const atMs = Math.max(0, Math.round(sfx.atSec * 1000));
        const vol = Math.min(Math.max(sfx.volume ?? 1, 0), 2);
        const label = `sfx${i}`;
        filters.push(
          `[${nextAudioInputIndex}:a]aformat=sample_fmts=fltp:channel_layouts=stereo,` +
            `adelay=${atMs}|${atMs},volume=${vol},apad,atrim=0:${totalDur.toFixed(2)}[${label}]`
        );
        audioLabels.push(label);
        nextAudioInputIndex += 1;
      });

      let audioMapArgs: string[] = [];
      if (audioLabels.length === 1) {
        filters.push(`[${audioLabels[0]}]anull[aout]`);
        audioMapArgs = ["-map", "[aout]"];
      } else if (audioLabels.length > 1) {
        filters.push(
          `${audioLabels.map((l) => `[${l}]`).join("")}amix=inputs=${audioLabels.length}:duration=longest:dropout_transition=0,volume=${audioLabels.length}[aout]`
        );
        audioMapArgs = ["-map", "[aout]"];
      }

      cmd
        .complexFilter(filters, [videoLabel])
        .outputOptions([
          ...audioMapArgs,
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-pix_fmt", "yuv420p",
          "-c:a", "aac",
          "-shortest",
          "-movflags", "+faststart",
        ])
        .output(outputPath)
        .on("progress", (p) => {
          const pct = Math.min(95, 45 + Math.round(((p.percent ?? 0) / 100) * 45));
          void setJob(jobId, { progress: pct });
        })
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });

    await setJob(jobId, { status: "EXPORTING", progress: 96, statusMessage: "Saving your video" });

    const dir = await ensureUserDir(job.project.userId);
    const finalFilename = `${randomUUID()}.mp4`;
    const { copyFile, stat: fsStat } = await import("node:fs/promises");
    await copyFile(outputPath, join(dir, finalFilename));
    const stat = await fsStat(join(dir, finalFilename));

    const resultAsset = await db.asset.create({
      data: {
        userId: job.project.userId,
        projectId: job.projectId,
        kind: "VIDEO",
        filename: `${job.project.name}.mp4`,
        storagePath: storagePathFor(job.project.userId, finalFilename),
        mimeType: "video/mp4",
        sizeBytes: stat.size,
        durationSec: totalDur,
      },
    });

    // Real thumbnail — a genuine mid-video frame, not a placeholder icon.
    let thumbnailAssetId: string | null = null;
    try {
      const thumbPath = join(workDir, "thumb.jpg");
      await new Promise<void>((resolve, reject) => {
        ffmpeg(outputPath)
          .seekInput(Math.max(totalDur / 2, 0.1))
          .frames(1)
          .outputOptions(["-vf", "scale=360:-2"])
          .output(thumbPath)
          .on("end", () => resolve())
          .on("error", (err) => reject(err))
          .run();
      });
      const thumbStat = await fsStat(thumbPath);
      const thumbFilename = `${randomUUID()}.jpg`;
      const { readFile, writeFile } = await import("node:fs/promises");
      await writeFile(join(dir, thumbFilename), await readFile(thumbPath));
      const thumbAsset = await db.asset.create({
        data: {
          userId: job.project.userId,
          projectId: job.projectId,
          kind: "IMAGE",
          filename: `${job.project.name} thumbnail.jpg`,
          storagePath: storagePathFor(job.project.userId, thumbFilename),
          mimeType: "image/jpeg",
          sizeBytes: thumbStat.size,
        },
      });
      thumbnailAssetId = thumbAsset.id;
    } catch (err) {
      // Thumbnail generation is a nice-to-have — never fail the whole job
      // over it, the video itself already rendered successfully.
      console.error(`[job ${jobId}] thumbnail generation failed:`, err);
    }

    await setJob(jobId, {
      status: "COMPLETED",
      progress: 100,
      statusMessage: "Done",
      resultAssetId: resultAsset.id,
      thumbnailAssetId,
      creditsCharged: job.creditsEstimated,
    });
  } catch (err) {
    const message =
      err instanceof UserFacingError
        ? err.message
        : "VIDORA could not complete this generation. Your project is safe — please try again.";
    console.error(`[job ${jobId}] failed:`, err);
    await setJob(jobId, { status: "FAILED", error: message, creditsCharged: 0 });
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

class UserFacingError extends Error {}
