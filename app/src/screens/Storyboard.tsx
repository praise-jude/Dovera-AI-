import { useStore } from "../lib/store";
import { Chip, Placeholder } from "../components/ui";
import { SCENES } from "../lib/data";
import { IconEdit, IconRegenerate, IconDelete } from "../components/icons";
import { FloatingCta } from "../components/FloatingCta";

export function Storyboard() {
  const { openScene, openSheet, char } = useStore();

  return (
    <div className="screen storyboard-screen vup">
      <div className="context-chips">
        <Chip selected>{char} locked</Chip>
        <Chip>9:16 · 24s</Chip>
        <Chip>Luxury</Chip>
      </div>

      <div className="scene-list">
        {SCENES.map((s) => (
          <div key={s.id} className="scene-card">
            <div className="scene-card-body">
              <Placeholder className="scene-thumb" />
              <div className="scene-thumb-meta">
                <span className="mono">{String(s.id).padStart(2, "0")}</span>
                <span className="mono">{s.duration}</span>
              </div>
              <div className="scene-info">
                <div className="scene-name">{s.name}</div>
                <div className="scene-desc">{s.desc}</div>
                <div className="scene-meta-chips">
                  <span className="meta-chip mono">{s.camera}</span>
                  <span className="meta-chip mono">{s.motion}</span>
                  <span className="meta-chip mono">{s.duration}</span>
                </div>
              </div>
            </div>
            <div className="scene-actions">
              <button className="scene-action" onClick={() => openScene(s.id)}>
                <IconEdit width={15} height={15} /> Edit
              </button>
              <button className="scene-action scene-action-accent">
                <IconRegenerate width={15} height={15} /> Regenerate
              </button>
              <button className="scene-action scene-action-danger">
                <IconDelete width={15} height={15} /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="add-scene-btn">+ Add scene</button>

      <div style={{ height: 72 }} />
      <FloatingCta label="Generate · est. 48 credits" onClick={openSheet} />
    </div>
  );
}
