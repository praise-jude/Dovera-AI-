import type { SceneData } from "./types";

export const SCENES: SceneData[] = [
  { id: 1, name: "Introduction", desc: "Establishing shot of the product on a marble surface, soft golden-hour light.", camera: "Wide Shot", motion: "Static", duration: "6s" },
  { id: 2, name: "Main Action", desc: "Hero product reveal — bottle rotates into frame as light catches the glass.", camera: "Dolly Shot", motion: "Slow push", duration: "6s" },
  { id: 3, name: "Cinematic Highlight", desc: "Macro detail on serum droplet falling in slow motion.", camera: "Close-up", motion: "Slow motion", duration: "6s" },
  { id: 4, name: "Final Scene", desc: "Product centered with soft focus background, logo fades in.", camera: "Medium Shot", motion: "Static", duration: "6s" },
];

export const ANSWER_CHIPS = [
  "Skincare serum",
  "Marble studio",
  "Golden hour",
  "Slow & elegant",
  "Add my character",
];

export const SUGGESTIONS = [
  "Advertise my restaurant",
  "Property walkthrough",
  "Founder intro",
];

export const STUDIOS = [
  { id: "ad", title: "Ad Studio", meta: "Product photo → advert" },
  { id: "script", title: "Script → Video", meta: "Paste, auto-split scenes" },
  { id: "character", title: "Character Lock", meta: "3 saved characters" },
  { id: "templates", title: "Templates", meta: "9 categories" },
];

export const CONTINUE_PROJECTS = [
  { id: 1, name: "Aurora Skincare", meta: "4 scenes · v3", target: "result" as const },
  { id: 2, name: "Lagos Bistro", meta: "Draft · not charged", target: "storyboard" as const },
];

export const CAMERA_OPTIONS = [
  "Wide Shot", "Close-up", "Medium Shot", "Over-the-Shoulder", "Low Angle",
  "High Angle", "Tracking Shot", "Dolly Shot", "Orbit Shot", "Drone Shot",
];

export const AD_STYLES = ["Luxury", "Modern", "Social Media", "Cinematic", "Minimal", "E-commerce", "Product Launch"];

export const CHARACTERS = [
  { id: "sarah", name: "Sarah", desc: "Mid-20s, warm smile, studio wardrobe" },
  { id: "dami", name: "Chef Dami", desc: "40s, chef whites, confident presence" },
  { id: "narrator", name: "Narrator", desc: "Voice-only, no on-screen reference" },
];

export const TEMPLATES = [
  { id: "t1", name: "Product Advert", ratio: "9:16", meta: "4 scenes · 24s" },
  { id: "t2", name: "Restaurant Promo", ratio: "9:16", meta: "5 scenes · 30s" },
  { id: "t3", name: "Real Estate Tour", ratio: "16:9", meta: "6 scenes · 36s" },
  { id: "t4", name: "Business Intro", ratio: "1:1", meta: "3 scenes · 18s" },
  { id: "t5", name: "Motivational", ratio: "9:16", meta: "4 scenes · 24s" },
  { id: "t6", name: "Educational", ratio: "16:9", meta: "5 scenes · 40s" },
  { id: "t7", name: "YouTube Short", ratio: "9:16", meta: "4 scenes · 20s" },
  { id: "t8", name: "Social Promo", ratio: "1:1", meta: "3 scenes · 15s" },
  { id: "t9", name: "Event Promo", ratio: "9:16", meta: "5 scenes · 28s" },
];

export const MAGIC_SUGGESTIONS = [
  { type: "+", title: "Specify lighting", body: "Add a lighting direction to reduce flat exposure risk.", applied: false },
  { type: "!", title: "Conflicting prompt", body: "\"Fast-paced\" and \"slow & elegant\" are both present — pick one.", applied: false },
  { type: "+", title: "Name the camera move", body: "A named move (dolly, orbit) renders more predictably than \"dynamic\".", applied: false },
];

export const CAPTION_CUES = [
  { time: "0:00", text: "Some mornings deserve more" },
  { time: "0:04", text: "than water." },
  { time: "0:11", text: "Aurora Serum — 30ml" },
  { time: "0:19", text: "Now in stock." },
];

export const VOICES = [
  { id: "amara", name: "Amara", meta: "EN-NG · warm female" },
  { id: "kwame", name: "Kwame", meta: "EN-GH · deep male" },
  { id: "lena", name: "Lena", meta: "EN-US · bright female" },
  { id: "noor", name: "Noor", meta: "AR · calm female" },
];

export const FORMATS = [
  { id: "tiktok", name: "TikTok Vertical", w: 1080, h: 1920, shape: "vertical" as const },
  { id: "reels", name: "Instagram Reels", w: 1080, h: 1920, shape: "vertical" as const },
  { id: "shorts", name: "YouTube Shorts", w: 1080, h: 1920, shape: "vertical" as const },
  { id: "yt", name: "YouTube Landscape", w: 1920, h: 1080, shape: "landscape" as const },
  { id: "square", name: "Square Post", w: 1080, h: 1080, shape: "square" as const },
];

export const PROJECTS = [
  { id: "aurora", name: "Aurora Skincare", meta: "4 scenes · v3 · 41 credits", status: "READY" as const },
  { id: "lagos", name: "Lagos Bistro", meta: "Draft · not charged", status: "DRAFT" as const },
  { id: "ikoyi", name: "Ikoyi Duplex Tour", meta: "Scene 4 failed, refunded", status: "NEEDS REVIEW" as const },
  { id: "founder", name: "Founder Intro", meta: "Archived 3 months ago", status: "ARCHIVED" as const },
];

export const VERSIONS = [
  { id: "v3", label: "v3", note: "Voice replaced with Amara", current: true },
  { id: "v2", label: "v2", note: "Scene 3 regenerated · orbit", current: false },
  { id: "v1", label: "v1", note: "First generation from Director plan", current: false },
];

export const SCREEN_META: Record<string, { title: string; subtitle: string }> = {
  home: { title: "VIDORA AI", subtitle: "Director ready" },
  director: { title: "VIDORA Director", subtitle: "Building your plan" },
  storyboard: { title: "Storyboard", subtitle: "Aurora Skincare · draft" },
  scene: { title: "Scene 2 · Main Action", subtitle: "Hero product reveal" },
  character: { title: "Character Lock", subtitle: "Reuse a face across scenes" },
  ad: { title: "Ad Studio", subtitle: "Product → advert" },
  script: { title: "Script → Video", subtitle: "Paste, split, generate" },
  templates: { title: "Template Library", subtitle: "9 categories" },
  magic: { title: "Prompt Magic", subtitle: "Readiness 82 / 100" },
  generating: { title: "Generating", subtitle: "Runs in the background" },
  result: { title: "Final cut", subtitle: "Aurora Skincare · v3" },
  formats: { title: "Social Auto-Format", subtitle: "One cut, five ratios" },
  voice: { title: "Voice Studio", subtitle: "Preview before you commit" },
  captions: { title: "Captions Studio", subtitle: "Auto transcript · editable" },
  projects: { title: "My Projects", subtitle: "Autosaved · versioned" },
  slideshow: { title: "Photo Slideshow", subtitle: "Real generation — no simulation" },
  "music-library": { title: "My Music & Sounds", subtitle: "Your uploads, real storage" },
  billing: { title: "Billing", subtitle: "Manage your subscription" },
};
