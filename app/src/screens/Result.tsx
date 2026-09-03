import { useStore } from "../lib/store";
import { Chip, Placeholder } from "../components/ui";
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

export function Result() {
  const { go, openSheet } = useStore();

  return (
    <div className="screen result-screen vup">
      <div className="player">
        <Placeholder className="player-bg" />
        <button className="player-play" aria-label="Play">
          <IconPlay width={22} height={22} />
        </button>
        <span className="mono player-caption">final cut · 9:16 · 24s</span>
      </div>

      <div className="result-header">
        <div className="result-title">Aurora Skincare — Luxury</div>
        <div className="result-meta">v3 · 4 scenes · 41 credits used</div>
        <button className="link-btn" onClick={() => go("projects")}>History</button>
      </div>

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
    </div>
  );
}
