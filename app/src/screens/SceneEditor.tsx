import { useStore } from "../lib/store";
import { Chip, Placeholder } from "../components/ui";
import { CAMERA_OPTIONS, SCENES } from "../lib/data";
import { IconMagic } from "../components/icons";
import { FloatingCta } from "../components/FloatingCta";

export function SceneEditor() {
  const { cam, setCam, activeSceneId, go, openSheet, char } = useStore();
  const scene = SCENES.find((s) => s.id === activeSceneId) || SCENES[1];

  return (
    <div className="screen scene-editor-screen vup">
      <Placeholder label={`frame 0${scene.id}`} className="scene-ref-frame" />

      <div className="card scene-prompt-card">
        <p className="scene-prompt-text">{scene.desc}</p>
      </div>

      <div className="readiness-strip">
        <div>
          <div className="readiness-title">Prompt Readiness: High</div>
          <div className="readiness-sub">Lighting, camera and subject are all specified.</div>
        </div>
        <button className="soft-chip" onClick={() => go("magic")}>
          <IconMagic width={13} height={13} /> Magic
        </button>
      </div>

      <div className="section-label">Camera Director</div>
      <div className="camera-grid">
        {CAMERA_OPTIONS.map((c) => (
          <Chip key={c} selected={cam === c} onClick={() => setCam(c)} className="camera-chip">
            {c}
          </Chip>
        ))}
      </div>

      <button className="char-row" onClick={() => go("character")}>
        <Placeholder className="char-row-avatar" />
        <div className="char-row-info">
          <div className="char-row-name">{char} · Locked · 3 reference frames</div>
        </div>
        <span className="link-btn">Change</span>
      </button>
      <p className="disclaimer-note">
        Your current provider supports reference frames but cannot guarantee exact likeness across scenes.
      </p>

      <div style={{ height: 72 }} />
      <FloatingCta label="Generate · est. 48 credits" onClick={openSheet} />
    </div>
  );
}
