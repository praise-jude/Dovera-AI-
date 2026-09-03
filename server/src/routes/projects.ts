import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, type AuthedRequest } from "../lib/auth.js";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.get("/", async (req: AuthedRequest, res) => {
  const projects = await db.project.findMany({
    where: { userId: req.userId! },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { assets: true, jobs: true } } },
  });
  res.json({ projects });
});

const createSchema = z.object({ name: z.string().min(1).max(120) });

projectsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Give your project a name." });
    return;
  }
  const project = await db.project.create({
    data: { name: parsed.data.name, userId: req.userId! },
  });
  res.status(201).json({ project });
});

projectsRouter.get("/:id", async (req: AuthedRequest, res) => {
  const project = await db.project.findFirst({
    where: { id: req.params.id as string, userId: req.userId! },
    include: {
      assets: { orderBy: { createdAt: "desc" } },
      jobs: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  res.json({ project });
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  status: z.enum(["DRAFT", "READY", "NEEDS_REVIEW", "ARCHIVED"]).optional(),
});

projectsRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid update." });
    return;
  }
  const owned = await db.project.findFirst({ where: { id: req.params.id as string, userId: req.userId! } });
  if (!owned) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  const project = await db.project.update({ where: { id: owned.id }, data: parsed.data });
  res.json({ project });
});

projectsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const owned = await db.project.findFirst({ where: { id: req.params.id as string, userId: req.userId! } });
  if (!owned) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  await db.project.delete({ where: { id: owned.id } });
  res.status(204).end();
});
