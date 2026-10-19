import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { Button, Chip } from "../components/ui";
import { IconClose } from "../components/icons";
import * as api from "../lib/api";
import type { AiVideoResolution, TextToVideoDuration, TextToVideoRatio } from "../lib/api";

type GenMode = "text" | "image";
type ActiveProvider = "fal" | "runway" | null;

// Everything below is a real, working control — reordering/duration/seed/
// resolution/negative-prompt all actually change the request sent to the
// provider (see store.tsx). They're just not the DEFAULT experience: type a
// prompt, hit Generate, VIDORA picks sensible values for the rest. Open
// "Advanced" only if you want to change them.
const DEFAULT_RATIO: TextToVideoRatio = "9:16";
const DEFAULT_DURATION: TextToVideoDuration = 5;
const DEFAULT_RESOLUTION: AiVideoResolution = "480p";

const RATIOS: { id: TextToVideoRatio; label: string }[] = [
  { id: "9:16", label: "9:16 Vertical" },
  { id: "16:9", label: "16:9 Landscape" },
  { id: "1:1", label: "1:1 Square" },
];
const DURATIONS: TextToVideoDuration[] = [5, 10];
const RESOLUTIONS: { id: AiVideoResolution; label: string; multiplier: number }[] = [
  { id: "480p", label: "480p", multiplier: 1 },
  { id: "720p", label: "720p", multiplier: 2 },
  { id: "1080p", label: "1080p", multiplier: 3 },
];
const CREDITS_PER_SECOND = 5;

export function PromptVideo() {
  const { startTextToVideo, startImageToVideo } = useStore();
  const [checking, setChecking] = useState(true);
  const [textProvider, setTextProvider] = useState<ActiveProvider>(null);
  const [imageProvider, setImageProvider] = useState<ActiveProvider>(null);
  const [providerError, setProviderError] = useState<string | null>(null);

  const [mode, setMode] = useState<GenMode>("text");
  const [prompt, setPrompt] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [ratio, setRatio] = useState<TextToVideoRatio>(DEFAULT_RATIO);
  const [duration, setDuration] = useState<TextToVideoDuration>(DEFAULT_DURATION);
  const [resolution, setResolution] = useState<AiVideoResolution>(DEFAULT_RESOLUTION);
  const [seedInput, setSeedInput] = useState("");

  useEffect(() => {
    api
      .ensureAuth()
      .then(() => api.listProviders())
      .then((providers) => {
        const pick = (capability: string): ActiveProvider => {
          const fal = providers.find((p) => p.capability === capability && p.name === "fal");
          const runway = providers.find((p) => p.capability === capability && p.name === "runway");
          return fal?.configured ? "fal" : runway?.configured ? "runway" : null;
        };
        setTextProvider(pick("TEXT_TO_VIDEO"));
        setImageProvider(pick("IMAGE_TO_VIDEO"));
      })
      .catch(() => setProviderError("Couldn't check whether this is set up yet. Please try again."))
      .finally(() => setChecking(false));
  }, []);

  const activeProvider = mode === "text" ? textProvider : imageProvider;
  const configured = activeProvider !== null;
  const multiplier = RESOLUTIONS.find((r) => r.id === resolution)?.multiplier ?? 1;
  const cost = duration * CREDITS_PER_SECOND * multiplier;
  const seed = seedInput.trim() ? Number(seedInput.trim()) : undefined;
  const seedValid = seedInput.trim() === "" || (Number.isInteger(seed) && (seed ?? -1) >= 0);
  const canGenerate = configured && prompt.trim().length >= 3 && seedValid && (mode === "text" || photo !== null);

  const generate = () => {
    if (mode === "text") {
      startTextToVideo({
        projectName: "",
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim() || undefined,
        ratio,
        duration,
        resolution,
        seed,
      });
    } else if (photo) {
      startImageToVideo({
        projectName: "",
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim() || undefined,
        image: photo,
        duration,
        resolution,
        seed,
      });
    }
  };

  return (
    <div className="screen slideshow-screen vup">
      <div className="real-badge">
        <span className="real-badge-dot" />
        {activeProvider === "fal"
          ? "Real AI generation — sent to fal.ai, not simulated"
          : activeProvider === "runway"
            ? "Real AI generation — sent to Runway, not simulated"
            : "Real AI generation — sent to an external video model, not simulated"}
      </div>

      <p className="disclaimer-note" style={{ margin: "10px 2px 18px" }}>
        Type what you want and VIDORA generates a real video from it — this calls a paid external AI
        model per generation, unlike Photo Slideshow.
      </p>

      {!checking && !configured && (
        <div className="disclaimer-note" style={{ margin: "0 2px 16px", color: "var(--warn)" }}>
          Not set up yet on this server — it needs a funded API key (fal.ai or Runway) added first.
          This screen is real and ready to go the moment that's configured; nothing here is a mockup.
        </div>
      )}
      {providerError && (
        <div className="disclaimer-note" style={{ margin: "0 2px 16px", color: "var(--warn)" }}>
          {providerError}
        </div>
      )}

      {mode === "image" && (
        <>
          {photo ? (
            <div className="slideshow-photo-list" style={{ marginBottom: 12 }}>
              <div className="slideshow-photo-row">
                <img className="slideshow-photo-row-thumb" src={URL.createObjectURL(photo)} alt="Selected" />
                <div className="slideshow-photo-row-info">
                  <span className="mono">{photo.name}</span>
                </div>
                <button className="library-icon-btn library-icon-btn-danger" aria-label="Remove photo" onClick={() => setPhoto(null)}>
                  <IconClose width={13} height={13} />
                </button>
              </div>
            </div>
          ) : (
            <button className="add-scene-btn" style={{ marginBottom: 12 }} onClick={() => photoInputRef.current?.click()}>
              + Choose a photo to animate
            </button>
          )}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) setPhoto(file);
            }}
          />
        </>
      )}

      <textarea
        className="prompt-textarea"
        placeholder={
          mode === "text"
            ? "Describe the video you want, e.g. a dragon flying over snowy mountains at sunset…"
            : "Describe the motion, e.g. the ocean waves start moving, camera slowly zooms in…"
        }
        value={prompt}
        onChange={(e) => setPrompt(e.target.value.slice(0, 1000))}
        rows={5}
        style={{ marginBottom: 10, width: "100%", boxSizing: "border-box" }}
      />

      <button className="link-btn" style={{ marginBottom: 18 }} onClick={() => setMode(mode === "text" ? "image" : "text")}>
        {mode === "text" ? "Or animate one of your own photos instead" : "Or generate from text only instead"}
      </button>

      <Button variant="primary" full disabled={!canGenerate} onClick={generate} style={{ marginBottom: 10 }}>
        {!configured ? "Not configured yet" : `Generate video (${cost} credits)`}
      </Button>

      <button className="link-btn" onClick={() => setShowAdvanced((v) => !v)}>
        {showAdvanced ? "Hide advanced options" : "Advanced options"}
      </button>

      {showAdvanced && (
        <div style={{ marginTop: 14 }}>
          <div className="section-label" style={{ marginTop: 0 }}>Avoid (optional)</div>
          <input
            className="text-input"
            placeholder="e.g. blurry, cartoonish, text overlay, distorted faces"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value.slice(0, 500))}
            style={{ marginBottom: 16 }}
          />

          {mode === "text" && (
            <>
              <div className="section-label">Aspect ratio</div>
              <div className="style-chip-row">
                {RATIOS.map((r) => (
                  <Chip key={r.id} selected={ratio === r.id} onClick={() => setRatio(r.id)}>{r.label}</Chip>
                ))}
              </div>
            </>
          )}

          <div className="section-label">Length</div>
          <div className="style-chip-row">
            {DURATIONS.map((d) => (
              <Chip key={d} selected={duration === d} onClick={() => setDuration(d)}>{d}s</Chip>
            ))}
          </div>

          <div className="section-label">Quality</div>
          <div className="style-chip-row">
            {RESOLUTIONS.map((r) => (
              <Chip key={r.id} selected={resolution === r.id} onClick={() => setResolution(r.id)}>
                {r.label} · {duration * CREDITS_PER_SECOND * r.multiplier} credits
              </Chip>
            ))}
          </div>

          <div className="section-label">Seed (optional)</div>
          <input
            className="text-input"
            type="number"
            min={0}
            placeholder="Leave blank for a random result each time"
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            style={{ marginBottom: 4 }}
          />
          {!seedValid && (
            <p className="disclaimer-note" style={{ color: "var(--warn)", margin: "0 2px 0" }}>
              Seed must be a whole number, 0 or higher.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
