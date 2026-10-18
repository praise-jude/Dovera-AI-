import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { Button, Chip } from "../components/ui";
import { IconClose } from "../components/icons";
import * as api from "../lib/api";
import type { AiVideoResolution, TextToVideoDuration, TextToVideoRatio } from "../lib/api";

type GenMode = "text" | "image";

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

type ActiveProvider = "fal" | "runway" | null;

export function PromptVideo() {
  const { startTextToVideo, startImageToVideo } = useStore();
  const [checking, setChecking] = useState(true);
  const [textProvider, setTextProvider] = useState<ActiveProvider>(null);
  const [imageProvider, setImageProvider] = useState<ActiveProvider>(null);
  const [providerError, setProviderError] = useState<string | null>(null);

  const [mode, setMode] = useState<GenMode>("text");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [ratio, setRatio] = useState<TextToVideoRatio>("9:16");
  const [duration, setDuration] = useState<TextToVideoDuration>(5);
  const [resolution, setResolution] = useState<AiVideoResolution>("480p");
  const [seedInput, setSeedInput] = useState("");
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .ensureAuth()
      .then(() => api.listProviders())
      .then((providers) => {
        // fal preferred over Runway when both are configured, same order
        // the backend worker uses.
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
        projectName: name,
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim() || undefined,
        ratio,
        duration,
        resolution,
        seed,
      });
    } else if (photo) {
      startImageToVideo({
        projectName: name,
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
          ? "Real AI generation — sent to fal.ai (Wan 2.5), not simulated"
          : activeProvider === "runway"
            ? "Real AI generation — sent to Runway, not simulated"
            : "Real AI generation — sent to an external video model, not simulated"}
      </div>

      <div className="mode-switch" role="tablist" aria-label="Generation mode" style={{ margin: "12px 0" }}>
        <button role="tab" aria-selected={mode === "text"} className={`mode-seg ${mode === "text" ? "mode-seg-active" : ""}`} onClick={() => setMode("text")}>
          Write a prompt
        </button>
        <button role="tab" aria-selected={mode === "image"} className={`mode-seg ${mode === "image" ? "mode-seg-active" : ""}`} onClick={() => setMode("image")}>
          Animate a photo
        </button>
      </div>

      <p className="disclaimer-note" style={{ margin: "0 2px 16px" }}>
        {mode === "text"
          ? "VIDORA generates a brand-new AI video purely from your description — no photos needed."
          : "VIDORA animates one of your own photos with real AI-generated motion, guided by your description — not a Ken Burns pan."}
        {" "}This calls a paid external AI model per generation, unlike Photo Slideshow.
      </p>

      {!checking && !configured && (
        <div className="disclaimer-note" style={{ margin: "0 2px 16px", color: "var(--warn)" }}>
          Not set up yet on this server — it needs a funded API key (fal.ai or Runway) added first.
          Everything below is real and ready to go the moment that's configured; nothing here is a mockup.
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

      {mode === "image" && (
        <>
          <div className="section-label" style={{ marginTop: 0 }}>Your photo</div>
          {photo ? (
            <div className="slideshow-photo-list" style={{ marginBottom: 10 }}>
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
            <button className="add-scene-btn" onClick={() => photoInputRef.current?.click()}>
              + Choose a photo
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
          <div className="disclaimer-note" style={{ margin: "8px 2px 16px" }}>
            The animation keeps your photo's own aspect ratio — no separate ratio choice needed.
          </div>
        </>
      )}

      <div className="section-label" style={{ marginTop: 0 }}>
        {mode === "text" ? "Describe the video" : "Describe the motion"}
      </div>
      <textarea
        className="prompt-textarea"
        placeholder={
          mode === "text"
            ? "e.g. a dragon flying over snowy mountains at sunset, cinematic camera"
            : "e.g. the ocean waves start moving, camera slowly zooms in"
        }
        value={prompt}
        onChange={(e) => setPrompt(e.target.value.slice(0, 1000))}
        rows={4}
        style={{ marginBottom: 16, width: "100%", boxSizing: "border-box" }}
      />

      <div className="section-label" style={{ marginTop: 0 }}>Avoid (optional)</div>
      <input
        className="text-input"
        placeholder="e.g. blurry, cartoonish, text overlay, distorted faces"
        value={negativePrompt}
        onChange={(e) => setNegativePrompt(e.target.value.slice(0, 500))}
        style={{ marginBottom: 16 }}
      />
      <p className="disclaimer-note" style={{ margin: "-10px 2px 16px" }}>
        Tells the model what to rule out — directly helps realism by steering away from common AI-video artifacts.
      </p>

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
      <p className="disclaimer-note" style={{ margin: "8px 2px 16px" }}>
        Higher resolution costs more credits — it's a real quality difference in the generated video, not just a label.
      </p>

      <div className="section-label" style={{ marginTop: 0 }}>Seed (optional)</div>
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
        <p className="disclaimer-note" style={{ color: "var(--warn)", margin: "0 2px 12px" }}>
          Seed must be a whole number, 0 or higher.
        </p>
      )}
      <p className="disclaimer-note" style={{ margin: "8px 2px 16px" }}>
        Reuse the same seed to get a consistent look across tries — the result screen shows the seed you actually got,
        so you can copy it back in here.
      </p>

      <Button variant="primary" full disabled={!canGenerate} onClick={generate}>
        {!configured ? "Not configured yet" : `Generate video (${cost} credits)`}
      </Button>
    </div>
  );
}
