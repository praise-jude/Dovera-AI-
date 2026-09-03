import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, type AuthedRequest } from "../lib/auth.js";
import { runSlideshowJob } from "../worker/slideshow.js";

export const jobsRouter = Router();
jobsRouter.use(requireAuth);

const CREDITS_PER_SLIDESHOW = 5;

const createSchema = z.object({
  projectId: z.string(),
  type: z.literal("SLIDESHOW_VIDEO"),
  params: z.object({
    imageAssetIds: z.array(z.string()).min(1).max(12),
    musicAssetId: z.string().optional(),
    secondsPerImage: z.number().min(1.5).max(8).optional(),
    aspectRatio: z.enum(["9:16", "16:9", "1:1"]).optional(),
    captions: z
      .array(z.object({ text: z.string().max(200), atSec: z.number().min(0), durationSec: z.number().min(0.5) }))
      .max(20)
      .optional(),
  }),
});

jobsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid job request." });
    return;
  }
  const { projectId, params } = parsed.data;

  const project = await db.project.findFirst({ where: { id: projectId, userId: req.userId! } });
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }

  const user = await db.user.findUniqueOrThrow({ where: { id: req.userId! } });
  const estimate = CREDITS_PER_SLIDESHOW;
  if (user.credits < estimate) {
    res.status(402).json({ error: "Not enough credits for this generation.", creditsRequired: estimate, creditsAvailable: user.credits });
    return;
  }

  const job = await db.job.create({
    data: {
      projectId,
      type: "SLIDESHOW_VIDEO",
      provider: "ffmpeg-local",
      status: "QUEUED",
      params: params as object,
      creditsEstimated: estimate,
    },
  });

  // Fire-and-forget: the HTTP response returns immediately with the job id;
  // the client polls GET /jobs/:id for status. On completion we deduct
  // creditsEstimated from the user; on failure we deduct nothing.
  void runSlideshowJob(job.id).then(async () => {
    const finished = await db.job.findUnique({ where: { id: job.id } });
    if (finished?.status === "COMPLETED" && finished.creditsCharged > 0) {
      await db.user.update({
        where: { id: req.userId! },
        data: { credits: { decrement: finished.creditsCharged } },
      });
    }
  });

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
