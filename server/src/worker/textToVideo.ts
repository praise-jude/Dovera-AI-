import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import { randomUUID } from "node:crypto";
import { chmod, mkdtemp, readFile, rm, stat as fsStat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "../db.js";
import { ensureUserDir, storagePathFor } from "../lib/storage.js";
import { createTextToVideoTask, getTask, RunwayError, type RunwayDuration, type RunwayRatio } from "../lib/runway.js";

ffmpeg.setFfmpegPath(ffmpegPath.path);
void chmod(ffmpegPath.path, 0o755).catch(() => {});

export interface TextToVideoParams {
  prompt: string;
  ratio: RunwayRatio;
  duration: RunwayDuration;
}

async function setJob(jobId: string, data: Parameters<typeof db.job.update>[0]["data"]) {
  await db.job.update({ where: { id: jobId }, data });
}

const POLL_INTERVAL_MS = 4000;
const MAX_WAIT_MS = 8 * 60 * 1000; // Runway generations typically finish in under a couple of minutes

class UserFacingError extends Error {}

export async function runTextToVideoJob(jobId: string): Promise<void> {
  const job = await db.job.findUnique({ where: { id: jobId }, include: { project: true } });
  if (!job) return;
  const params = job.params as unknown as TextToVideoParams;

  let workDir: string | null = null;
  try {
    await setJob(jobId, { status: "GENERATING", progress: 5, statusMessage: "Sending prompt to Runway" });

    const task = await createTextToVideoTask({
      promptText: params.prompt,
      ratio: params.ratio,
      duration: params.duration,
    });

    const startedAt = Date.now();
    let result: Awaited<ReturnType<typeof getTask>> | null = null;
    while (Date.now() - startedAt < MAX_WAIT_MS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const polled = await getTask(task.id);
      if (polled.status === "SUCCEEDED") {
        result = polled;
        break;
      }
      if (polled.status === "FAILED") {
        throw new UserFacingError(polled.failure || "Runway couldn't generate a video from this prompt.");
      }
      // PENDING / THROTTLED / RUNNING — keep waiting, surface real status.
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

    await setJob(jobId, { status: "EXPORTING", progress: 95, statusMessage: "Saving your video" });

    workDir = await mkdtemp(join(tmpdir(), "vidora-t2v-"));
    const videoRes = await fetch(result.output[0]);
    if (!videoRes.ok) throw new UserFacingError("Couldn't download the generated video from Runway.");
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

    const dir = await ensureUserDir(job.project.userId);
    const finalFilename = `${randomUUID()}.mp4`;
    await writeFile(join(dir, finalFilename), videoBuffer);
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
        durationSec: params.duration,
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
          .seekInput(Math.max(params.duration / 2, 0.1))
          .frames(1)
          .outputOptions(["-vf", "scale=360:-2"])
          .output(thumbPath)
          .on("end", () => resolve())
          .on("error", (err) => reject(err))
          .run();
      });
      const thumbStat = await fsStat(thumbPath);
      const thumbFilename = `${randomUUID()}.jpg`;
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
          : "VIDORA could not complete this generation. Your project is safe — please try again.";
    console.error(`[job ${jobId}] failed:`, err);
    await setJob(jobId, { status: "FAILED", error: message, creditsCharged: 0 });
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
