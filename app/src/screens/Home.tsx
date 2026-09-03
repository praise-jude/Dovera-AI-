import { useState, type ComponentType, type SVGProps } from "react";
import { useStore } from "../lib/store";
import { Button, Chip, Placeholder, SectionLabel } from "../components/ui";
import { STUDIOS, SUGGESTIONS, CONTINUE_PROJECTS } from "../lib/data";
import { IconAd, IconScript, IconCharacter, IconTemplates, IconMagic } from "../components/icons";
import type { Mode } from "../lib/types";

const MODES: Mode[] = ["Text → Video", "Image → Video", "Director"];

const PLACEHOLDER_BY_MODE: Record<Mode, string> = {
  "Text → Video": "A slow zoom on a cup of coffee steaming on a wooden table...",
  "Image → Video": "Bring this product photo to life with a subtle camera drift...",
  "Director": "Advertise my new skincare serum with a luxury, golden-hour feel...",
};

const STUDIO_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  ad: IconAd,
  script: IconScript,
  character: IconCharacter,
  templates: IconTemplates,
};

export function Home() {
  const { mode, setMode, go } = useStore();
  const [prompt, setPrompt] = useState("");

  return (
    <div className="screen home-screen vup">
      <h1 className="hero-title">What are we making today?</h1>
      <p className="hero-sub">Type an idea. Director handles the rest.</p>

      <div className="mode-switch" role="tablist" aria-label="Generation mode">
        {MODES.map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            className={`mode-seg ${mode === m ? "mode-seg-active" : ""}`}
            onClick={() => setMode(m)}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="prompt-card">
        <textarea
          className="prompt-textarea"
          placeholder={PLACEHOLDER_BY_MODE[mode]}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          aria-label="Describe your idea"
        />
        <div className="prompt-footer">
          <div className="prompt-footer-chips">
            <button className="soft-chip" onClick={() => go("magic")}>
              <IconMagic width={13} height={13} /> Prompt Magic
            </button>
            <button className="soft-chip" onClick={() => go("character")}>Character</button>
          </div>
          <Button
            variant="primary"
            onClick={() => go(mode === "Director" ? "director" : "director")}
          >
            Direct it →
          </Button>
        </div>
      </div>

      <div className="suggestion-row">
        {SUGGESTIONS.map((s) => (
          <Chip key={s} onClick={() => { setPrompt(s); go("director"); }}>{s}</Chip>
        ))}
      </div>

      <div className="real-cta-row">
        <button className="real-cta" onClick={() => go("slideshow")}>
          <div className="real-badge"><span className="real-badge-dot" /> Real generation</div>
          <div className="real-cta-title">Photo Slideshow</div>
          <div className="real-cta-meta">Upload photos — get back an actual rendered video.</div>
        </button>
        <button className="real-cta" onClick={() => go("music-library")}>
          <div className="real-badge"><span className="real-badge-dot" /> Real storage</div>
          <div className="real-cta-title">🎵 My Music &amp; Sounds</div>
          <div className="real-cta-meta">Upload and manage your own music and sound effects.</div>
        </button>
      </div>

      <SectionLabel>Studios</SectionLabel>
      <div className="studio-grid">
        {STUDIOS.map((s) => {
          const Icon = STUDIO_ICONS[s.id];
          return (
            <button key={s.id} className="studio-card" onClick={() => go(s.id as any)}>
              <span className="studio-icon"><Icon width={18} height={18} /></span>
              <span className="studio-title">{s.title}</span>
              <span className="studio-meta">{s.meta}</span>
            </button>
          );
        })}
      </div>

      <div className="continue-header">
        <SectionLabel>Continue</SectionLabel>
        <button className="link-btn" onClick={() => go("projects")}>All projects</button>
      </div>
      <div className="continue-row">
        {CONTINUE_PROJECTS.map((p) => (
          <button key={p.id} className="continue-card" onClick={() => go(p.target)}>
            <Placeholder label="frame 01" className="continue-thumb" />
            <span className="continue-name">{p.name}</span>
            <span className="continue-meta">{p.meta}</span>
          </button>
        ))}
      </div>

      <div style={{ height: 8 }} />
    </div>
  );
}
