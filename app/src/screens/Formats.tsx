import { useStore } from "../lib/store";
import { Button, Placeholder } from "../components/ui";
import { FORMATS } from "../lib/data";

export function Formats() {
  const { fmt, toggleFmt, openSheet } = useStore();

  return (
    <div className="screen formats-screen vup">
      <p className="formats-intro">
        Reframed with subject-aware composition, not a blind crop. Review each before export.
      </p>

      <div className="formats-list">
        {FORMATS.map((f) => {
          const on = fmt.includes(f.id);
          return (
            <div key={f.id} className="format-row">
              <Placeholder className={`format-preview format-preview-${f.shape}`} />
              <div className="format-info">
                <div className="format-name">{f.name}</div>
                <div className="format-dims mono">{f.w}×{f.h}</div>
              </div>
              <Button variant={on ? "primary" : "secondary"} onClick={() => toggleFmt(f.id)}>
                {on ? "On" : "Add"}
              </Button>
            </div>
          );
        })}
      </div>

      <Button variant="primary" full onClick={openSheet}>Export selected</Button>
    </div>
  );
}
