import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { extname, join } from "node:path";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { db } from "../db.js";
import { requireAuth, type AuthedRequest } from "../lib/auth.js";
import { absolutePath, ensureUserDir, storagePathFor } from "../lib/storage.js";
import type { AssetKind } from "@prisma/client";

export const assetsRouter = Router();
assetsRouter.use(requireAuth);

const ALLOWED_MIME: Record<string, AssetKind> = {
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/webp": "IMAGE",
  "audio/mpeg": "AUDIO",
  "audio/wav": "AUDIO",
  "audio/x-wav": "AUDIO",
  "audio/mp4": "AUDIO",
  "audio/aac": "AUDIO",
  "audio/ogg": "AUDIO",
  "video/mp4": "VIDEO",
  "video/quicktime": "VIDEO",
  "video/webm": "VIDEO",
};

const MAX_BYTES = 200 * 1024 * 1024; // 200MB per upload

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME[file.mimetype]) {
      cb(new Error("UNSUPPORTED_TYPE"));
      return;
    }
    cb(null, true);
  },
});

assetsRouter.post("/", upload.single("file"), async (req: AuthedRequest, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file received." });
    return;
  }
  const kind = ALLOWED_MIME[file.mimetype];
  const projectId = typeof req.body.projectId === "string" ? req.body.projectId : undefined;

  if (projectId) {
    const owned = await db.project.findFirst({ where: { id: projectId, userId: req.userId! } });
    if (!owned) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
  }

  const dir = await ensureUserDir(req.userId!);
  const filename = `${randomUUID()}${extname(file.originalname) || ""}`;
  const storagePath = storagePathFor(req.userId!, filename);
  const { writeFile } = await import("node:fs/promises");
  await writeFile(join(dir, filename), file.buffer);

  const asset = await db.asset.create({
    data: {
      userId: req.userId!,
      projectId: projectId ?? null,
      kind,
      filename: file.originalname,
      storagePath,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    },
  });

  res.status(201).json({ asset });
});

// fileFilter throws a plain Error; surface it as a clean 400 instead of a 500.
assetsRouter.use((err: unknown, _req: AuthedRequest, res: import("express").Response, next: import("express").NextFunction) => {
  if (err instanceof Error && err.message === "UNSUPPORTED_TYPE") {
    res.status(400).json({ error: "That file type isn't supported yet." });
    return;
  }
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: "File too large or malformed upload." });
    return;
  }
  next(err);
});

assetsRouter.get("/", async (req: AuthedRequest, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  const assets = await db.asset.findMany({
    where: { userId: req.userId!, ...(projectId ? { projectId } : {}) },
    orderBy: { createdAt: "desc" },
  });
  res.json({ assets });
});

assetsRouter.get("/:id/file", async (req: AuthedRequest, res) => {
  const asset = await db.asset.findFirst({ where: { id: req.params.id as string, userId: req.userId! } });
  if (!asset) {
    res.status(404).json({ error: "Asset not found." });
    return;
  }
  const path = absolutePath(asset.storagePath);
  try {
    const s = await stat(path);
    res.setHeader("Content-Type", asset.mimeType);
    res.setHeader("Content-Length", String(s.size));
    createReadStream(path).pipe(res);
  } catch {
    res.status(404).json({ error: "File is missing from storage." });
  }
});

assetsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const asset = await db.asset.findFirst({ where: { id: req.params.id as string, userId: req.userId! } });
  if (!asset) {
    res.status(404).json({ error: "Asset not found." });
    return;
  }
  await db.asset.delete({ where: { id: asset.id } });
  res.status(204).end();
});
