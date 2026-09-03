import { Router } from "express";
import { requireAuth } from "../lib/auth.js";

export const providersRouter = Router();
providersRouter.use(requireAuth);

// A provider "slot" is real infrastructure the router knows how to call the
// moment an API key is added — never a fake button. `configured` reflects
// whether that key is actually present in this deployment's environment.
const REGISTRY = [
  {
    capability: "IMAGE_TO_VIDEO",
    name: "ffmpeg-local",
    configured: true,
    kind: "deterministic",
    description: "Ken Burns slideshow assembly — runs locally, no external cost, always available.",
  },
  {
    capability: "TEXT_TO_VIDEO",
    name: "runway",
    configured: Boolean(process.env.RUNWAY_API_KEY),
    kind: "ai-generative",
    description: "Neural text-to-video. Requires RUNWAY_API_KEY.",
  },
  {
    capability: "TEXT_TO_VIDEO",
    name: "luma",
    configured: Boolean(process.env.LUMA_API_KEY),
    kind: "ai-generative",
    description: "Neural text-to-video. Requires LUMA_API_KEY.",
  },
  {
    capability: "VOICE",
    name: "web-speech",
    configured: true,
    kind: "deterministic",
    description: "Browser-native text-to-speech — free, runs on the viewer's device.",
  },
  {
    capability: "VOICE",
    name: "elevenlabs",
    configured: Boolean(process.env.ELEVENLABS_API_KEY),
    kind: "ai-generative",
    description: "High-quality AI voice cloning/TTS. Requires ELEVENLABS_API_KEY.",
  },
  {
    capability: "MUSIC",
    name: "local-upload",
    configured: true,
    kind: "user-provided",
    description: "Your own uploaded tracks — always available, no licensing risk.",
  },
  {
    capability: "MUSIC",
    name: "mubert",
    configured: Boolean(process.env.MUBERT_API_KEY),
    kind: "ai-generative",
    description: "AI-generated licensed music. Requires MUBERT_API_KEY.",
  },
] as const;

providersRouter.get("/", (_req, res) => {
  res.json({ providers: REGISTRY });
});
