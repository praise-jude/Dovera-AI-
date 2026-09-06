import type { SlideshowStyle } from "./api";

// Deliberately simple keyword matching, not language understanding — this
// picks real settings the renderer already supports based on words in the
// prompt. It must never be presented as "AI understood your video"; the UI
// copy calls it "smart defaults from your description" for that reason.
export interface PromptDefaults {
  style: SlideshowStyle;
  secondsPerImage: number;
  title: string;
}

const STYLE_KEYWORDS: { style: SlideshowStyle; words: string[] }[] = [
  { style: "cinematic", words: ["wedding", "romantic", "love", "anniversary", "engagement", "elegant", "luxury"] },
  { style: "vibrant", words: ["party", "energetic", "fun", "travel", "adventure", "vacation", "festival", "celebration", "birthday"] },
  { style: "classic", words: ["business", "professional", "corporate", "product", "presentation", "portfolio"] },
];

export function deriveFromPrompt(prompt: string): PromptDefaults {
  const lower = prompt.toLowerCase();

  let style: SlideshowStyle = "kenburns";
  for (const entry of STYLE_KEYWORDS) {
    if (entry.words.some((w) => lower.includes(w))) {
      style = entry.style;
      break;
    }
  }

  const isEnergetic = /party|energetic|fast|fun|festival|celebration/.test(lower);
  const isSlow = /calm|relax|slow|gentle|peaceful|memorial|tribute/.test(lower);
  const secondsPerImage = isEnergetic ? 2 : isSlow ? 4.5 : 3;

  const title = prompt.trim().length > 0 ? prompt.trim().charAt(0).toUpperCase() + prompt.trim().slice(1, 80) : "";

  return { style, secondsPerImage, title };
}
