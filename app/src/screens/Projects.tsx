import { useStore } from "../lib/store";
import { Button, Placeholder } from "../components/ui";
import { PROJECTS, VERSIONS } from "../lib/data";

const STATUS_CLASS: Record<string, string> = {
  READY: "status-badge-accent",
  DRAFT: "status-badge-neutral",
  "NEEDS REVIEW": "status-badge-warn",
  ARCHIVED: "status-badge-neutral",
};

export function Projects() {
  const { go } = useStore();

  return (
    <div className="screen projects-screen vup">
      <div className="project-list">
        {PROJECTS.map((p) => (
          <button key={p.id} className="project-row" onClick={() => go("result")}>
            <Placeholder className="project-thumb" />
            <div className="project-info">
              <div className="project-name">{p.name}</div>
              <div className="project-meta">{p.meta}</div>
            </div>
            <span className={`mono status-badge ${STATUS_CLASS[p.status]}`}>{p.status}</span>
          </button>
        ))}
      </div>

      <div className="section-label">Version history · Aurora Skincare</div>
      <div className="card version-card">
        {VERSIONS.map((v) => (
          <div key={v.id} className="version-row">
            <span className="mono version-label">{v.label}</span>
            <span className="version-note">{v.note}</span>
            {v.current ? (
              <span className="mono version-current">Current</span>
            ) : (
              <Button variant="secondary">Restore</Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
