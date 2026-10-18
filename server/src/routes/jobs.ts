import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, type AuthedRequest } from "../lib/auth.js";
import { runSlideshowJob } from "../worker/slideshow.js";
import { runTextToVideoJob, runImageToVideoJob, falCreditMultiplierFor } from "../worker/textToVideo.js";
import { isRunwayConfigured } from "../lib/runway.js";
import { isFalConfigured } from "../lib/fal.js";
import { waitUntil } from "@vercel/functions";

export const jobsRouter = Router();
jobsRouter.use(requireAuth);

const CREDITS_PER_SLIDESHOW = 5;
// Runway's Gen-4 Turbo and fal.ai's Wan 2.5 (at its cheapest 480p tier) both
// cost about $0.05/real-second — these charge roughly the same $-per-credit
// rate as the rest of the app rather than a flat number, so a longer clip
// visibly costs more credits.
const CREDITS_PER_T2V_SECOND = 5;

const slideshowSchema = z.object({
  projectId: z.string(),
  type: z.literal("SLIDESHOW_VIDEO"),
  params: z.object({
    imageAssetIds: z.array(z.string()).min(1).max(12),
    musicAssetId: z.string().optional(),
    musicVolume: z.number().min(0).max(2).optional(),
    musicStartSec: z.number().min(0).max(3600).optional(),
    soundEffects: z
      .array(z.object({ assetId: z.string(), atSec: z.number().min(0), volume: z.number().min(0).max(2).optional() }))
      .max(10)
      .optional(),
    secondsPerImage: z.number().min(1.5).max(8).optional(),
    durations: z.array(z.number().min(1).max(12)).max(12).optional(),
    aspectRatio: z.enum(["9:16", "16:9", "1:1"]).optional(),
    style: z.enum(["kenburns", "cinematic", "vibrant", "classic"]).optional(),
    captions: z
      .array(z.object({ text: z.string().max(200), atSec: z.number().min(0), durationSec: z.number().min(0.5) }))
      .max(20)
      .optional(),
  }),
});

const aiVideoCommonFields = {
  prompt: z.string().min(3).max(1000),
  negativePrompt: z.string().max(500).optional(),
  duration: z.number().min(4).max(10),
  resolution: z.enum(["480p", "720p", "1080p"]).optional(),
  seed: z.number().int().min(0).max(2147483647).optional(),
};

const textToVideoSchema = z.object({
  projectId: z.string(),
  type: z.literal("TEXT_TO_VIDEO"),
  params: z.object({
    ...aiVideoCommonFields,
    // Provider-agnostic ratio/duration — the worker snaps these to whichever
    // grid the active provider (fal or Runway) actually accepts.
    ratio: z.enum(["9:16", "16:9", "1:1"]),
  }),
});

const imageToVideoSchema = z.object({
  projectId: z.string(),
  type: z.literal("IMAGE_TO_VIDEO"),
  params: z.object({
    ...aiVideoCommonFields,
    imageAssetId: z.string(),
  }),
});

const createSchema = z.discriminatedUnion("type", [slideshowSchema, textToVideoSchema, imageToVideoSchema]);

jobsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid job request." });
    return;
  }
  const { projectId, type, params } = parsed.data;

  const isAiVideo = type === "TEXT_TO_VIDEO" || type === "IMAGE_TO_VIDEO";
  if (isAiVideo && !isFalConfigured() && !isRunwayConfigured()) {
    res.status(503).json({ error: "AI video generation isn't configured on this server yet. Please try again shortly." });
    return;
  }

  if (type === "IMAGE_TO_VIDEO") {
    const sourcePhoto = await db.asset.findFirst({ where: { id: params.imageAssetId, userId: req.userId!, kind: "IMAGE" } });
    if (!sourcePhoto) {
      res.status(404).json({ error: "That photo couldn't be found." });
      return;
    }
  }

  const project = await db.project.findFirst({ where: { id: projectId, userId: req.userId! } });
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }

  const user = await db.user.findUniqueOrThrow({ where: { id: req.userId! } });
  // Resolution multiplies the per-second rate the same way it multiplies
  // fal's real cost (480p/720p/1080p = 1x/2x/3x) — only meaningful when fal
  // is the active provider, but applied uniformly as this app's own pricing.
  const resolutionMultiplier = isAiVideo ? falCreditMultiplierFor(params.resolution ?? "480p") : 1;
  const estimate =
    type === "SLIDESHOW_VIDEO" ? CREDITS_PER_SLIDESHOW : params.duration * CREDITS_PER_T2V_SECOND * resolutionMultiplier;
  if (user.credits < estimate) {
    res.status(402).json({ error: "Not enough credits for this generation.", creditsRequired: estimate, creditsAvailable: user.credits });
    return;
  }

  const job = await db.job.create({
    data: {
      projectId,
      type,
      provider: !isAiVideo ? "ffmpeg-local" : isFalConfigured() ? "fal" : "runway",
      status: "QUEUED",
      params: params as object,
      creditsEstimated: estimate,
    },
  });

  // The HTTP response returns immediately with the job id; the client polls
  // GET /jobs/:id for status. On completion we deduct creditsEstimated from
  // the user; on failure we deduct nothing.
  //
  // This continues running AFTER the response is sent, which on Vercel's
  // serverless runtime requires waitUntil() — a bare un-awaited promise gets
  // frozen/killed the moment the handler returns, since nothing tells the
  // platform the invocation isn't really done yet. waitUntil extends the
  // invocation's lifetime (up to the function's own maxDuration) to cover it.
  const run = type === "SLIDESHOW_VIDEO" ? runSlideshowJob : type === "IMAGE_TO_VIDEO" ? runImageToVideoJob : runTextToVideoJob;
  const jobPromise = run(job.id).then(async () => {
    const finished = await db.job.findUnique({ where: { id: job.id } });
    if (finished?.status === "COMPLETED" && finished.creditsCharged > 0) {
      await db.user.update({
        where: { id: req.userId! },
        data: { credits: { decrement: finished.creditsCharged } },
      });
    }
  });
  waitUntil(jobPromise);

  res.status(202).json({ job, creditsEstimated: estimate });
});

jobsRouter.get("/:id", async (req: AuthedRequest, res) => {
  const job = await db.job.findFirst({
    where: { id: req.params.id as string, project: { userId: req.userId! } },
    include: { resultAsset: true },
  });
  if (!job) {
    res.status(404).json({ error: "Job not found." });
    return;
  }
  res.json({ job });
});

jobsRouter.get("/", async (req: AuthedRequest, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  const jobs = await db.job.findMany({
    where: { project: { userId: req.userId! }, ...(projectId ? { projectId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ jobs });
});
