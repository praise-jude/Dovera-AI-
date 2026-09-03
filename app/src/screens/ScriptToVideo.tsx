import { useState } from "react";
import { useStore } from "../lib/store";
import { Button, Placeholder } from "../components/ui";

const SCRIPT = `Open on the Aurora Serum bottle catching golden light. Cut to a hand applying it in a slow morning routine. Show the marble packaging with the logo. End on the bottle centered with soft focus.`;

const DETECTED = [
  { name: "Introduction", line: "Open on the Aurora Serum bottle catching golden light." },
  { name: "Main Action", line: "Cut to a hand applying it in a slow morning routine." },
  { name: "Cinematic Highlight", line: "Show the marble packaging with the logo." },
  { name: "Final Scene", line: "End on the bottle centered with soft focus." },
];

export function ScriptToVideo() {
  const { go } = useStore();
  const [split, setSplit] = useState(false);

  return (
    <div className="screen script-screen vup">
      <div className="card script-card">
        <p className="script-text">{SCRIPT}</p>
      </div>
      <div className="mono script-meta">{SCRIPT.length} chars · ~18s read</div>

      <Button variant="primary" full onClick={() => setSplit(true)}>Split into scenes</Button>

      {split && (
        <div className="vup">
          <div className="section-label">Detected scenes</div>
          <div className="detected-list">
            {DETECTED.map((d) => (
              <button key={d.name} className="detected-row" onClick={() => go("scene")}>
                <Placeholder className="detected-thumb" />
                <div className="detected-info">
                  <div className="detected-name">{d.name}</div>
                  <div className="detected-line">&ldquo;{d.line}&rdquo;</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
