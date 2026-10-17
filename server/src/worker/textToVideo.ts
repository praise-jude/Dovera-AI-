import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import { randomUUID } from "node:crypto";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "../db.js";
import { saveFile, storagePathFor, uploadLocalFile } from "../lib/storage.js";
import { createTextToVideoTask as createRunwayTask, getTask as getRunwayTask, RunwayError, type RunwayDuration, type RunwayRatio } from "../lib/runway.js";
import {
  createTextToVideoTask as createFalTask,
  getTaskStatus as getFalStatus,
  getTaskResult as getFalResult,
  isFalConfigured,
  FalError,
  type FalAspectRatio,
  type FalDuration,
} from "../lib/fal.js";

ffmpeg.setFfmpegPath(ffmpegPath.path);
void chmod(ffmpegPath.path, 0o755).catch(() => {});

// Provider-agnostic shape stored on the job — a plain "9:16"-style ratio and
// a duration in seconds. Each provider's adapter below clamps/converts this
// to whatever it actually accepts, so the route/UI never need to know which
// provider ends up serving a given request.
export interface TextToVideoParams {
  prompt: string;
  ratio: "9:16" | "16:9" | "1:1";
  duration: number;
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

function toRunwayRatio(ratio: TextToVideoParams["ratio"]): RunwayRatio {
  return ratio === "9:16" ? "720:1280" : ratio === "16:9" ? "1280:720" : "960:960";
}

// Runway text-to-video only accepts 4/6/8s; fal only accepts 5/10s —
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

export async function runTextToVideoJob(jobId: string): Promise<void> {
  const job = await db.job.findUnique({ where: { id: jobId }, include: { project: true } });
  if (!job) return;
  const params = job.params as unknown as TextToVideoParams;

  // fal.ai is preferred when both are configured — cheaper per second and
  // new accounts get a small one-time free credit, so it's the "try before
  // you commit to Runway" path. See providers.ts for the same preference.
  const useFal = isFalConfigured();
  const providerLabel = useFal ? "fal.ai" : "Runway";

  let workDir: string | null = null;
  try {
    await setJob(jobId, { status: "GENERATING", progress: 5, statusMessage: `Sending prompt to ${providerLabel}` });

    let videoUrl: string;
    let actualDuration: number;

    if (useFal) {
      const falDuration = toFalDuration(params.duration);
      actualDuration = falDuration;
      const task = await createFalTask({
        prompt: params.prompt,
        aspectRatio: params.ratio as FalAspectRatio,
        duration: falDuration,
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
      videoUrl = result.video.url;
    } else {
      const runwayDuration = toRunwayDuration(params.duration);
      actualDuration = runwayDuration;
      const task = await createRunwayTask({
        promptText: params.prompt,
        ratio: toRunwayRatio(params.ratio),
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
          statusMessage:
            polled.status === "THROTTLED" ? "Queued — Runway is busy, waiting for a slot" : "Generating with Runway",
        });
      }
      if (!result || !result.output?.[0]) {
        throw new UserFacingError("Generation took longer than expected. Your credits were not charged — please try again.");
      }
      videoUrl = result.output[0];
    }

    await setJob(jobId, { status: "EXPORTING", progress: 95, statusMessage: "Saving your video" });

    workDir = await mkdtemp(join(tmpdir(), "vidora-t2v-"));
    const videoRes = await fetch(videoUrl);
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
        durationSec: actualDuration,
      },
    });

    // Real mid-frame thumbnail, same approach as the slideshow pipeline.
    let thumbnailAssetId: string | null = null;
    try {
      const localCopyPath = join(workDir, "source.mp4");
      await writeFile(localCopyPath, videoBuffer);
      const thumbPath = join(workDir, "thumb.jpg");
      await new Promise<void>((resolve, reject) => {
        ffmpeg(localCopyPath)
          .seekInput(Math.max(actualDuration / 2, 0.1))
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
        : err instanceof RunwayError
          ? err.message
          : err instanceof FalError
            ? err.message
            : "VIDORA could not complete this generation. Your project is safe — please try again.";
    console.error(`[job ${jobId}] failed:`, err);
    await setJob(jobId, { status: "FAILED", error: message, creditsCharged: 0 });
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
