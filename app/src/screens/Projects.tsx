import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { Placeholder } from "../components/ui";
import * as api from "../lib/api";
import type { Project } from "../lib/api";

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

  useEffect(() => {
    api
      .ensureAuth()
      .then(() => api.listProjects())
      .then(setProjects)
      .catch(() => setError("Couldn't load your projects."));
  }, []);

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
              <button
                key={p.id}
                className="project-row"
                onClick={() => status === "COMPLETED" && viewProjectResult(p.id)}
              >
                <Placeholder className="project-thumb" />
                <div className="project-info">
                  <div className="project-name">{p.name}</div>
                  <div className="project-meta">
                    {p._count.assets} file{p._count.assets === 1 ? "" : "s"} ·{" "}
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <span className={`mono status-badge ${STATUS_CLASS[status]}`}>{status}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
