import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import { randomUUID } from "node:crypto";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "../db.js";
import { saveFile, storagePathFor, uploadLocalFile } from "../lib/storage.js";
import { signToken } from "../lib/auth.js";
import {
  createTextToVideoTask as createRunwayTextTask,
  createImageToVideoTask as createRunwayImageTask,
  getTask as getRunwayTask,
  RunwayError,
  type RunwayDuration,
  type RunwayRatio,
} from "../lib/runway.js";
import {
  createTextToVideoTask as createFalTextTask,
  createImageToVideoTask as createFalImageTask,
  getTaskStatus as getFalStatus,
  getTaskResult as getFalResult,
  isFalConfigured,
  falCreditMultiplierFor,
  FalError,
  type FalAspectRatio,
  type FalDuration,
  type FalResolution,
} from "../lib/fal.js";

ffmpeg.setFfmpegPath(ffmpegPath.path);
void chmod(ffmpegPath.path, 0o755).catch(() => {});

// Same URL the frontend falls back to (api.ts) — used to build a URL
// fal.ai's/Runway's servers (which fetch the source image themselves, not
// something we upload to them) can reach for image-to-video.
const PUBLIC_API_BASE = process.env.PUBLIC_API_BASE || "https://vidora-api.vercel.app";

// Provider-agnostic shape stored on the job — a plain "9:16"-style ratio and
// a duration in seconds. Each provider's adapter below clamps/converts this
// to whatever it actually accepts, so the route/UI never need to know which
// provider ends up serving a given request.
export interface TextToVideoParams {
  prompt: string;
  negativePrompt?: string;
  ratio: "9:16" | "16:9" | "1:1";
  duration: number;
  resolution?: "480p" | "720p" | "1080p";
  seed?: number;
}

export interface ImageToVideoParams {
  prompt: string;
  negativePrompt?: string;
  imageAssetId: string;
  duration: number;
  resolution?: "480p" | "720p" | "1080p";
  seed?: number;
}

async function setJob(jobId: string, data: Parameters<typeof db.job.update>[0]["data"]) {
  await db.job.update({ where: { id: jobId }, data });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const POLL_INTERVAL_MS = 4000;
// Clamped to fit inside a single Vercel Function invocation (300s on Hobby,
// configurable up to 800s on Pro) with headroom left for downloading the
// result, generating a thumbnail, and uploading both — not just the
// provider's own generation wait. Raise this (and the function's
// maxDuration) together if upgrading past Hobby.
const MAX_WAIT_MS = 260 * 1000;

class UserFacingError extends Error {}

function toRunwayRatio(ratio: "9:16" | "16:9" | "1:1"): RunwayRatio {
  return ratio === "9:16" ? "720:1280" : ratio === "16:9" ? "1280:720" : "960:960";
}

// Runway text/image-to-video only accepts 4/6/8s; fal only accepts 5/10s —
// snap the user's requested duration to whichever grid the active
// provider actually supports, rather than rejecting anything off-grid.
function toRunwayDuration(duration: number): RunwayDuration {
  if (duration <= 5) return 4;
  if (duration <= 7) return 6;
  return 8;
}

function toFalDuration(duration: number): FalDuration {
  return duration <= 7 ? 5 : 10;
}

interface GenerationResult {
  videoUrl: string;
  actualDuration: number;
  actualPrompt?: string;
  actualSeed?: number;
}

async function generateViaFal(
  jobId: string,
  kind: "text" | "image",
  opts: { prompt: string; negativePrompt?: string; ratio?: "9:16" | "16:9" | "1:1"; imageUrl?: string; duration: number; resolution: FalResolution; seed?: number }
): Promise<GenerationResult> {
  const falDuration = toFalDuration(opts.duration);
  const task =
    kind === "text"
      ? await createFalTextTask({
          prompt: opts.prompt,
          negativePrompt: opts.negativePrompt,
          aspectRatio: opts.ratio as FalAspectRatio,
          duration: falDuration,
          resolution: opts.resolution,
          seed: opts.seed,
        })
      : await createFalImageTask({
          prompt: opts.prompt,
          negativePrompt: opts.negativePrompt,
          imageUrl: opts.imageUrl!,
          duration: falDuration,
          resolution: opts.resolution,
          seed: opts.seed,
        });

  const startedAt = Date.now();
  let completed = false;
  while (Date.now() - startedAt < MAX_WAIT_MS) {
    await sleep(POLL_INTERVAL_MS);
    const polled = await getFalStatus(task.statusUrl);
    if (polled.status === "COMPLETED") {
      completed = true;
      break;
    }
    if (polled.error) throw new UserFacingError(polled.error);
    const elapsedPct = Math.min(90, 10 + Math.round(((Date.now() - startedAt) / MAX_WAIT_MS) * 80));
    await setJob(jobId, {
      progress: elapsedPct,
      statusMessage:
        polled.status === "IN_QUEUE"
          ? `Queued with fal.ai${polled.queue_position != null ? ` — position ${polled.queue_position}` : ""}`
          : "Generating with fal.ai",
    });
  }
  if (!completed) {
    throw new UserFacingError("Generation took longer than expected. Your credits were not charged — please try again.");
  }
  const result = await getFalResult(task.responseUrl);
  if (!result.video?.url) throw new UserFacingError("fal.ai didn't return a video for this prompt.");
  return { videoUrl: result.video.url, actualDuration: falDuration, actualPrompt: result.actual_prompt, actualSeed: result.seed };
}

async function generateViaRunway(
  jobId: string,
  kind: "text" | "image",
  opts: { prompt: string; ratio: "9:16" | "16:9" | "1:1"; imageUrl?: string; duration: number }
): Promise<GenerationResult> {
  const runwayDuration = toRunwayDuration(opts.duration);
  const runwayRatio = toRunwayRatio(opts.ratio);
  const task =
    kind === "text"
      ? await createRunwayTextTask({ promptText: opts.prompt, ratio: runwayRatio, duration: runwayDuration })
      : await createRunwayImageTask({
          promptText: opts.prompt,
          promptImage: opts.imageUrl!,
          ratio: runwayRatio,
          duration: runwayDuration,
        });

  const startedAt = Date.now();
  let result: Awaited<ReturnType<typeof getRunwayTask>> | null = null;
  while (Date.now() - startedAt < MAX_WAIT_MS) {
    await sleep(POLL_INTERVAL_MS);
    const polled = await getRunwayTask(task.id);
    if (polled.status === "SUCCEEDED") {
      result = polled;
      break;
    }
    if (polled.status === "FAILED") {
      throw new UserFacingError(polled.failure || "Runway couldn't generate a video from this prompt.");
    }
    const elapsedPct = Math.min(90, 10 + Math.round(((Date.now() - startedAt) / MAX_WAIT_MS) * 80));
    await setJob(jobId, {
      progress: elapsedPct,
      statusMessage: polled.status === "THROTTLED" ? "Queued — Runway is busy, waiting for a slot" : "Generating with Runway",
    });
  }
  if (!result || !result.output?.[0]) {
    throw new UserFacingError("Generation took longer than expected. Your credits were not charged — please try again.");
  }
  return { videoUrl: result.output[0], actualDuration: runwayDuration };
}

// Shared tail for both job types: download the provider's video, save it +
// a real mid-frame thumbnail to Blob storage, and mark the job COMPLETED —
// also stashes the expanded prompt / actual seed fal returned back onto the
// job's params so the UI can show "here's what was actually generated" and
// offer to reuse the same seed, without a schema migration for it.
async function finishJob(
  jobId: string,
  job: { project: { userId: string; name: string }; projectId: string; creditsEstimated: number; params: unknown },
  providerLabel: string,
  gen: GenerationResult
): Promise<void> {
  const workDir = await mkdtemp(join(tmpdir(), "vidora-aiv-"));
  try {
    await setJob(jobId, { status: "EXPORTING", progress: 95, statusMessage: "Saving your video" });

    const videoRes = await fetch(gen.videoUrl);
    if (!videoRes.ok) throw new UserFacingError(`Couldn't download the generated video from ${providerLabel}.`);
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

    const finalFilename = `${randomUUID()}.mp4`;
    const finalStoragePath = storagePathFor(job.project.userId, finalFilename);
    const { size: finalSize } = await saveFile(finalStoragePath, videoBuffer, "video/mp4");

    const resultAsset = await db.asset.create({
      data: {
        userId: job.project.userId,
        projectId: job.projectId,
        kind: "VIDEO",
        filename: `${job.project.name}.mp4`,
        storagePath: finalStoragePath,
        mimeType: "video/mp4",
        sizeBytes: finalSize,
        durationSec: gen.actualDuration,
      },
    });

    let thumbnailAssetId: string | null = null;
    try {
      const localCopyPath = join(workDir, "source.mp4");
      await writeFile(localCopyPath, videoBuffer);
      const thumbPath = join(workDir, "thumb.jpg");
      await new Promise<void>((resolve, reject) => {
        ffmpeg(localCopyPath)
          .seekInput(Math.max(gen.actualDuration / 2, 0.1))
          .frames(1)
          .outputOptions(["-vf", "scale=360:-2"])
          .output(thumbPath)
          .on("end", () => resolve())
          .on("error", (err) => reject(err))
          .run();
      });
      const thumbFilename = `${randomUUID()}.jpg`;
      const thumbStoragePath = storagePathFor(job.project.userId, thumbFilename);
      const { size: thumbSize } = await uploadLocalFile(thumbStoragePath, thumbPath, "image/jpeg");
      const thumbAsset = await db.asset.create({
        data: {
          userId: job.project.userId,
          projectId: job.projectId,
          kind: "IMAGE",
          filename: `${job.project.name} thumbnail.jpg`,
          storagePath: thumbStoragePath,
          mimeType: "image/jpeg",
          sizeBytes: thumbSize,
        },
      });
      thumbnailAssetId = thumbAsset.id;
    } catch (err) {
      console.error(`[job ${jobId}] thumbnail generation failed:`, err);
    }

    const updatedParams = {
      ...(job.params as object),
      ...(gen.actualPrompt ? { expandedPrompt: gen.actualPrompt } : {}),
      ...(gen.actualSeed != null ? { resultSeed: gen.actualSeed } : {}),
    };

    await setJob(jobId, {
      status: "COMPLETED",
      progress: 100,
      statusMessage: "Done",
      resultAssetId: resultAsset.id,
      thumbnailAssetId,
      creditsCharged: job.creditsEstimated,
      params: updatedParams,
    });
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function handleFailure(jobId: string, err: unknown): Promise<void> {
  const message =
    err instanceof UserFacingError
      ? err.message
      : err instanceof RunwayError
        ? err.message
        : err instanceof FalError
          ? err.message
          : "VIDORA could not complete this generation. Your project is safe — please try again.";
  console.error(`[job ${jobId}] failed:`, err);
  await setJob(jobId, { status: "FAILED", error: message, creditsCharged: 0 });
}

// fal.ai is preferred when both are configured — cheaper per second and new
// accounts get a small one-time free credit, so it's the "try before you
// commit to Runway" path. Same preference in providers.ts and the frontend.
function activeProviderLabel(): "fal.ai" | "Runway" {
  return isFalConfigured() ? "fal.ai" : "Runway";
}

export async function runTextToVideoJob(jobId: string): Promise<void> {
  const job = await db.job.findUnique({ where: { id: jobId }, include: { project: true } });
  if (!job) return;
  const params = job.params as unknown as TextToVideoParams;
  const providerLabel = activeProviderLabel();

  try {
    await setJob(jobId, { status: "GENERATING", progress: 5, statusMessage: `Sending prompt to ${providerLabel}` });
    const gen = isFalConfigured()
      ? await generateViaFal(jobId, "text", {
          prompt: params.prompt,
          negativePrompt: params.negativePrompt,
          ratio: params.ratio,
          duration: params.duration,
          resolution: params.resolution ?? "480p",
          seed: params.seed,
        })
      : await generateViaRunway(jobId, "text", { prompt: params.prompt, ratio: params.ratio, duration: params.duration });
    await finishJob(jobId, job, providerLabel, gen);
  } catch (err) {
    await handleFailure(jobId, err);
  }
}

export async function runImageToVideoJob(jobId: string): Promise<void> {
  const job = await db.job.findUnique({ where: { id: jobId }, include: { project: true } });
  if (!job) return;
  const params = job.params as unknown as ImageToVideoParams;
  const providerLabel = activeProviderLabel();

  try {
    await setJob(jobId, { status: "GENERATING", progress: 5, statusMessage: `Sending your photo to ${providerLabel}` });

    const sourceAsset = await db.asset.findFirst({
      where: { id: params.imageAssetId, userId: job.project.userId, kind: "IMAGE" },
    });
    if (!sourceAsset) throw new UserFacingError("That photo couldn't be found. Please re-upload and try again.");

    // fal.ai's/Runway's servers fetch this image themselves — they need a
    // URL they can reach, not a file we upload to them. Mint a real token
    // for this same user scoped the same way the client's own authenticated
    // asset URLs are (requireAuth + ownership check still applies on fetch).
    const imageUrl = `${PUBLIC_API_BASE}/assets/${sourceAsset.id}/file?token=${signToken(job.project.userId)}`;

    const gen = isFalConfigured()
      ? await generateViaFal(jobId, "image", {
          prompt: params.prompt,
          negativePrompt: params.negativePrompt,
          imageUrl,
          duration: params.duration,
          resolution: params.resolution ?? "480p",
          seed: params.seed,
        })
      : await generateViaRunway(jobId, "image", { prompt: params.prompt, ratio: "9:16", imageUrl, duration: params.duration });
    await finishJob(jobId, job, providerLabel, gen);
  } catch (err) {
    await handleFailure(jobId, err);
  }
}

export { falCreditMultiplierFor };
