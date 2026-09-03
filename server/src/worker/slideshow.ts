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

export interface SlideshowParams {
  imageAssetIds: string[];
  musicAssetId?: string;
  secondsPerImage?: number;
  aspectRatio?: "9:16" | "16:9" | "1:1";
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

    const size = ASPECT_SIZE[params.aspectRatio ?? "9:16"] ?? ASPECT_SIZE["9:16"];
    const perImageSec = Math.min(Math.max(params.secondsPerImage ?? 3, 1.5), 8);

    await setJob(jobId, { status: "GENERATING", progress: 15, statusMessage: "Building your scenes" });

    // Hard cuts via the `concat` filter rather than `xfade`: xfade needs
    // FFmpeg 4.3+ and the static binary this runs on (any platform) predates
    // that. concat has been stable since the 2.x line, so this renders
    // identically wherever the job runs.
    const clipDur = perImageSec;
    const inputs: string[] = [];
    const filters: string[] = [];

    orderedImages.forEach((img, i) => {
      inputs.push(absolutePath(img.storagePath));
      const frames = Math.round(clipDur * FPS);
      // zoompan expects a single held input frame (loop 1, no -t) and emits
      // exactly `d` frames from it; feeding it a time-limited input instead
      // multiplies frames-in by frames-out, so trim+setpts re-clamps the
      // output to the intended length regardless.
      filters.push(
        `[${i}:v]scale=${size.w}:${size.h}:force_original_aspect_ratio=increase,` +
          `crop=${size.w}:${size.h},setsar=1,` +
          `zoompan=z='min(zoom+0.0012,1.15)':d=${frames}:s=${size.w}x${size.h}:fps=${FPS},` +
          `trim=duration=${clipDur.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`
      );
    });

    let elapsed = clipDur * orderedImages.length;
    let videoOutLabel: string;
    if (orderedImages.length === 1) {
      videoOutLabel = "v0";
    } else {
      const concatInputs = orderedImages.map((_, i) => `[v${i}]`).join("");
      filters.push(`${concatInputs}concat=n=${orderedImages.length}:v=1:a=0[vout]`);
      videoOutLabel = "vout";
    }

    // burned-in captions
    let captionLabel = videoOutLabel;
    (params.captions ?? []).slice(0, 20).forEach((c, i) => {
      const next = `cap${i}`;
      const start = Math.max(c.atSec, 0);
      const end = start + Math.max(c.durationSec, 0.5);
      filters.push(
        `[${captionLabel}]drawtext=fontfile='${ESCAPED_FONT_PATH}':text='${escapeDrawtext(c.text)}':fontcolor=white:fontsize=${Math.round(
          size.w / 18
        )}:box=1:boxcolor=black@0.55:boxborderw=14:x=(w-text_w)/2:y=h-h/6:enable='between(t,${start},${end})'[${next}]`
      );
      captionLabel = next;
    });

    const totalDur = elapsed;
    const outputPath = join(workDir, "output.mp4");

    await setJob(jobId, { status: "PROCESSING", progress: 45, statusMessage: "Rendering frames" });

    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg();
      inputs.forEach((path) => cmd.input(path).inputOptions(["-loop 1"]));

      let audioMapArgs: string[] = [];
      if (music) {
        cmd.input(absolutePath(music.storagePath));
        filters.push(
          `[${inputs.length}:a]atrim=0:${totalDur.toFixed(2)},afade=t=in:st=0:d=1,` +
            `afade=t=out:st=${Math.max(totalDur - 1.5, 0).toFixed(2)}:d=1.5,volume=0.9[aout]`
        );
        audioMapArgs = ["-map", "[aout]"];
      }

      cmd
        .complexFilter(filters, [captionLabel])
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

    await setJob(jobId, {
      status: "COMPLETED",
      progress: 100,
      statusMessage: "Done",
      resultAssetId: resultAsset.id,
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
