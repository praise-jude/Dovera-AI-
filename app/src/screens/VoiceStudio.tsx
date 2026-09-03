import { useState } from "react";
import { useStore } from "../lib/store";
import { Button } from "../components/ui";
import { VOICES } from "../lib/data";
import { IconPlay } from "../components/icons";

export function VoiceStudio() {
  const { voice, setVoice } = useStore();
  const [speed, setSpeed] = useState(0.95);
  const [tone, setTone] = useState<"Warm" | "Neutral" | "Bold">("Warm");

  return (
    <div className="screen voice-screen vup">
      <div className="voice-list">
        {VOICES.map((v) => {
          const using = voice === v.name;
          return (
            <div key={v.id} className="voice-row">
              <button className="voice-preview-btn" aria-label={`Preview ${v.name}`}>
                <IconPlay width={13} height={13} />
              </button>
              <div className="voice-info">
                <div className="voice-name">{v.name}</div>
                <div className="voice-meta">{v.meta}</div>
              </div>
              <Button variant={using ? "primary" : "secondary"} onClick={() => setVoice(v.name)}>
                {using ? "Using" : "Preview"}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="card voice-controls-card">
        <div className="section-label" style={{ margin: 0 }}>Speed</div>
        <div className="voice-slider-row">
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.01}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="voice-slider"
            aria-label="Speed"
          />
          <span className="mono">{speed.toFixed(2)}×</span>
        </div>

        <div className="section-label">Tone</div>
        <div className="tone-3way">
          {(["Warm", "Neutral", "Bold"] as const).map((t) => (
            <button
              key={t}
              className={`tone-seg ${tone === t ? "tone-seg-active" : ""}`}
              onClick={() => setTone(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <p className="disclaimer-note">
        Replacing the voice does not regenerate the visuals — no video credits charged.
      </p>
    </div>
  );
}
