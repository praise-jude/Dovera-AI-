import { useState } from "react";
import { ScoreRing, Button } from "../components/ui";
import { MAGIC_SUGGESTIONS } from "../lib/data";
import { IconCheck } from "../components/icons";

export function PromptMagic() {
  const [applied, setApplied] = useState<Record<number, boolean>>({});

  return (
    <div className="screen magic-screen vup">
      <div className="magic-score-row">
        <ScoreRing score={82} />
        <div>
          <div className="readiness-title">Prompt Readiness: High</div>
          <div className="readiness-sub">
            A score of the prompt's detail — not a promise about the result.
          </div>
        </div>
      </div>

      <div className="section-label">Suggestions</div>
      <div className="suggestion-list">
        {MAGIC_SUGGESTIONS.map((s, i) => (
          <div key={i} className="suggestion-row-item">
            <span className={`suggestion-tag ${s.type === "!" ? "suggestion-tag-warn" : ""}`}>
              {s.type}
            </span>
            <div className="suggestion-body">
              <div className="suggestion-title">{s.title}</div>
              <div className="suggestion-text">{s.body}</div>
            </div>
            <Button
              variant={applied[i] ? "secondary" : "primary"}
              onClick={() => setApplied((a) => ({ ...a, [i]: true }))}
              disabled={applied[i]}
            >
              {applied[i] ? <><IconCheck width={13} height={13} /> Applied</> : "Apply"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
