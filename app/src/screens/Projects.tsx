import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { Placeholder } from "../components/ui";
import * as api from "../lib/api";
import type { Project } from "../lib/api";
import { IconEdit, IconDelete } from "../components/icons";

type DisplayStatus = "DRAFT" | "GENERATING" | "COMPLETED" | "FAILED";

const IN_PROGRESS_STATUSES = new Set([
  "QUEUED",
  "ANALYZING",
  "GENERATING",
  "PROCESSING",
  "ADDING_AUDIO",
  "RENDERING",
  "EXPORTING",
]);

function displayStatus(project: Project): DisplayStatus {
  const job = project.latestJob;
  if (!job) return "DRAFT";
  if (job.status === "COMPLETED") return "COMPLETED";
  if (job.status === "FAILED" || job.status === "CANCELLED") return "FAILED";
  if (IN_PROGRESS_STATUSES.has(job.status)) return "GENERATING";
  return "DRAFT";
}

const STATUS_CLASS: Record<DisplayStatus, string> = {
  COMPLETED: "status-badge-accent",
  DRAFT: "status-badge-neutral",
  GENERATING: "status-badge-neutral",
  FAILED: "status-badge-warn",
};

export function Projects() {
  const { viewProjectResult } = useStore();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const fetchedThumbIds = useRef<Set<string>>(new Set());

  const load = async () => {
    try {
      await api.ensureAuth();
      const list = await api.listProjects();
      setProjects(list);
    } catch {
      setError("Couldn't load your projects.");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!projects) return;
    for (const p of projects) {
      const thumbId = p.latestJob?.thumbnailAssetId;
      if (thumbId && !fetchedThumbIds.current.has(thumbId)) {
        fetchedThumbIds.current.add(thumbId);
        setThumbs((t) => ({ ...t, [p.id]: api.getAssetFileUrl(thumbId) }));
      }
    }
  }, [projects]);

  const doRename = async (id: string) => {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    const updated = await api.renameProject(id, renameValue.trim());
    setProjects((list) => list?.map((p) => (p.id === id ? { ...p, name: updated.name } : p)) ?? null);
    setRenamingId(null);
  };

  const doDelete = async (id: string) => {
    if (!window.confirm("Delete this project and its generated video? This can't be undone.")) return;
    await api.deleteProject(id);
    setProjects((list) => list?.filter((p) => p.id !== id) ?? null);
  };

  return (
    <div className="screen projects-screen vup">
      <div className="real-badge" style={{ marginBottom: 14 }}>
        <span className="real-badge-dot" /> Your real projects, saved to your account
      </div>

      {error && <p className="disclaimer-note" style={{ color: "var(--danger)" }}>{error}</p>}

      {projects === null && !error ? (
        <p className="disclaimer-note">Loading…</p>
      ) : projects && projects.length === 0 ? (
        <p className="disclaimer-note">
          No projects yet — generate a video from Photo Slideshow and it'll show up here.
        </p>
      ) : (
        <div className="project-list">
          {projects?.map((p) => {
            const status = displayStatus(p);
            return (
              <div key={p.id} className="project-row">
                <button
                  className="project-row-open"
                  onClick={() => status === "COMPLETED" && viewProjectResult(p.id)}
                >
                  {thumbs[p.id] ? (
                    <img className="project-thumb" src={thumbs[p.id]} alt="" />
                  ) : (
                    <Placeholder className="project-thumb" />
                  )}
                  <div className="project-info">
                    {renamingId === p.id ? (
                      <input
                        className="text-input"
                        style={{ height: 30, fontSize: 12 }}
                        value={renameValue}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => doRename(p.id)}
                        onKeyDown={(e) => e.key === "Enter" && doRename(p.id)}
                      />
                    ) : (
                      <div className="project-name">{p.name}</div>
                    )}
                    <div className="project-meta">
                      {p._count.assets} file{p._count.assets === 1 ? "" : "s"} ·{" "}
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`mono status-badge ${STATUS_CLASS[status]}`}>{status}</span>
                </button>
                <div className="project-row-actions">
                  <button
                    className="library-icon-btn"
                    aria-label={`Rename ${p.name}`}
                    onClick={() => {
                      setRenamingId(p.id);
                      setRenameValue(p.name);
                    }}
                  >
                    <IconEdit width={14} height={14} />
                  </button>
                  <button
                    className="library-icon-btn library-icon-btn-danger"
                    aria-label={`Delete ${p.name}`}
                    onClick={() => doDelete(p.id)}
                  >
                    <IconDelete width={14} height={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
