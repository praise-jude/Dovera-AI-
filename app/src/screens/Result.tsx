import { useState } from "react";
import { useStore } from "../lib/store";
import { Button, Chip, Placeholder } from "../components/ui";
import { IconPlay } from "../components/icons";

const FINISH = [
  { id: "voice", title: "Voice Studio", meta: "Amara · EN-NG" },
  { id: "captions", title: "Captions", meta: "Bold Social" },
  { id: "formats", title: "Formats", meta: "5 aspect ratios" },
  { id: "storyboard", title: "Storyboard", meta: "Edit one scene" },
];

const REMIX = [
  "More Cinematic", "More Realistic", "More Energetic",
  "Different Camera", "Different Weather", "Different Time of Day", "Different Style",
];

const EXPORT_FORMATS: { id: "9:16" | "16:9" | "1:1"; label: string }[] = [
  { id: "9:16", label: "9:16" },
  { id: "16:9", label: "16:9" },
  { id: "1:1", label: "1:1" },
];

export function Result() {
  const { go, openSheet, realResultUrl, realProjectId, realJobType, exportInFormat, startEditProject } = useStore();
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  return (
    <div className="screen result-screen vup">
      <div className="player">
        {realResultUrl ? (
          <>
            <video
              className="player-bg"
              src={realResultUrl}
              controls
              playsInline
              onError={() =>
                setPlaybackError(
                  "This device couldn't play the video preview. Try Download below, or open it in another app/browser."
                )
              }
            />
            {playbackError && (
              <p className="disclaimer-note" style={{ color: "var(--warn)", margin: "8px 2px 0" }}>
                {playbackError}
              </p>
            )}
          </>
        ) : (
          <>
            <Placeholder className="player-bg" />
            <button className="player-play" aria-label="Play">
              <IconPlay width={22} height={22} />
            </button>
            <span className="mono player-caption">final cut · 9:16 · 24s</span>
          </>
        )}
      </div>

      {realResultUrl && (
        <a className="download-cta" href={realResultUrl} download="vidora-video.mp4">
          ↓ Download video
        </a>
      )}

      {realResultUrl ? (
        <div className="result-header">
          <div className="real-badge" style={{ marginBottom: 8 }}>
            <span className="real-badge-dot" /> Real render, generated just now
          </div>
          <div className="result-title">Your video</div>
          <div className="result-meta">Rendered server-side just now</div>
        </div>
      ) : (
        <div className="result-header">
          <div className="result-title">Aurora Skincare — Luxury</div>
          <div className="result-meta">v3 · 4 scenes · 41 credits used</div>
          <button className="link-btn" onClick={() => go("projects")}>History</button>
        </div>
      )}

      {realResultUrl && realProjectId ? (
        <>
          {realJobType === "SLIDESHOW_VIDEO" && (
            <>
              <div className="section-label">Export as</div>
              <p className="disclaimer-note" style={{ margin: "0 2px 10px" }}>
                Re-renders your same photos, music and style at a different aspect ratio (uses credits again — it's a real render, not a crop).
              </p>
              <div className="style-chip-row" style={{ marginBottom: 14 }}>
                {EXPORT_FORMATS.map((f) => (
                  <Chip key={f.id} onClick={() => exportInFormat(f.id)}>{f.label}</Chip>
                ))}
              </div>
              <Button variant="secondary" full onClick={() => startEditProject(realProjectId)}>
                ✎ Edit &amp; regenerate
              </Button>
              <p className="disclaimer-note" style={{ margin: "6px 2px 0" }}>
                Reopens these photos, music and style so you can change something — the original stays untouched.
              </p>
            </>
          )}
        </>
      ) : (
        <>
          <div className="section-label">Finish</div>
          <div className="finish-grid">
            {FINISH.map((f) => (
              <button key={f.id} className="finish-card" onClick={() => go(f.id as any)}>
                <div className="finish-title">{f.title}</div>
                <div className="finish-meta">{f.meta}</div>
              </button>
            ))}
          </div>

          <div className="section-label">Remix · keeps the original</div>
          <div className="remix-chip-row">
            {REMIX.map((r) => (
              <Chip key={r} onClick={openSheet}>{r}</Chip>
            ))}
          </div>

          <button className="continue-cta" onClick={openSheet}>Continue this video →</button>
          <p className="disclaimer-note">
            Extension continues motion and style where the provider supports it — continuity isn't guaranteed.
          </p>
        </>
      )}
    </div>
  );
}
