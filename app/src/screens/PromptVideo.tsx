import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { Button, Chip } from "../components/ui";
import * as api from "../lib/api";
import type { TextToVideoDuration, TextToVideoRatio } from "../lib/api";

const RATIOS: { id: TextToVideoRatio; label: string }[] = [
  { id: "720:1280", label: "9:16 Vertical" },
  { id: "1280:720", label: "16:9 Landscape" },
  { id: "960:960", label: "1:1 Square" },
];

const DURATIONS: TextToVideoDuration[] = [4, 6, 8];
const CREDITS_PER_SECOND = 5;

export function PromptVideo() {
  const { startTextToVideo } = useStore();
  const [checking, setChecking] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState<TextToVideoRatio>("720:1280");
  const [duration, setDuration] = useState<TextToVideoDuration>(4);
  const [name, setName] = useState("");

  useEffect(() => {
    api
      .ensureAuth()
      .then(() => api.listProviders())
      .then((providers) => {
        const runway = providers.find((p) => p.capability === "TEXT_TO_VIDEO" && p.name === "runway");
        setConfigured(Boolean(runway?.configured));
      })
      .catch(() => setProviderError("Couldn't check whether this is set up yet. Please try again."))
      .finally(() => setChecking(false));
  }, []);

  const cost = duration * CREDITS_PER_SECOND;
  const canGenerate = configured && prompt.trim().length >= 3;

  return (
    <div className="screen slideshow-screen vup">
      <div className="real-badge">
        <span className="real-badge-dot" /> Real AI generation — sent to Runway's video model, not simulated
      </div>

      <p className="disclaimer-note" style={{ margin: "10px 2px 16px" }}>
        Type a description and VIDORA generates a brand-new AI video from it — no photos needed.
        This calls a paid external AI model per generation, unlike Photo Slideshow.
      </p>

      {!checking && !configured && (
        <div className="disclaimer-note" style={{ margin: "0 2px 16px", color: "var(--warn)" }}>
          Not set up yet on this server — it needs a funded Runway API key added first. Everything
          below is real and ready to go the moment that's configured; nothing here is a mockup.
        </div>
      )}
      {providerError && (
        <div className="disclaimer-note" style={{ margin: "0 2px 16px", color: "var(--warn)" }}>
          {providerError}
        </div>
      )}

      <input
        className="text-input"
        placeholder="Project name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ marginBottom: 16 }}
      />

      <div className="section-label" style={{ marginTop: 0 }}>Describe the video</div>
      <textarea
        className="prompt-textarea"
        placeholder="e.g. a dragon flying over snowy mountains at sunset, cinematic camera"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value.slice(0, 1000))}
        rows={4}
        style={{ marginBottom: 16, width: "100%", boxSizing: "border-box" }}
      />

      <div className="section-label">Aspect ratio</div>
      <div className="style-chip-row">
        {RATIOS.map((r) => (
          <Chip key={r.id} selected={ratio === r.id} onClick={() => setRatio(r.id)}>{r.label}</Chip>
        ))}
      </div>

      <div className="section-label">Length</div>
      <div className="style-chip-row">
        {DURATIONS.map((d) => (
          <Chip key={d} selected={duration === d} onClick={() => setDuration(d)}>
            {d}s · {d * CREDITS_PER_SECOND} credits
          </Chip>
        ))}
      </div>

      <p className="disclaimer-note" style={{ margin: "16px 2px" }}>
        Real AI video generation costs real money per clip, so it's priced higher than Photo
        Slideshow's local rendering — {CREDITS_PER_SECOND} credits per second.
      </p>

      <Button
        variant="primary"
        full
        disabled={!canGenerate}
        onClick={() => startTextToVideo({ projectName: name, prompt: prompt.trim(), ratio, duration })}
      >
        {!configured ? "Not configured yet" : `Generate video (${cost} credits)`}
      </Button>
    </div>
  );
}
