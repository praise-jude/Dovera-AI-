import { useStore } from "../lib/store";
import { Button, Chip, Placeholder } from "../components/ui";
import { CAPTION_CUES } from "../lib/data";
import { IconEdit } from "../components/icons";

const STYLES = ["Professional", "Cinematic", "Bold Social", "Minimal", "Educational"];

export function CaptionsStudio() {
  const { cap, setCap } = useStore();

  return (
    <div className="screen captions-screen vup">
      <div className="style-chip-row">
        {STYLES.map((s) => (
          <Chip key={s} selected={cap === s} onClick={() => setCap(s)}>{s}</Chip>
        ))}
      </div>

      <div className="captions-preview">
        <Placeholder />
        <span className="caption-chip">{CAPTION_CUES[0].text.toUpperCase()}</span>
      </div>

      <div className="cue-list">
        {CAPTION_CUES.map((c) => (
          <div key={c.time} className="cue-row">
            <span className="mono cue-time">{c.time}</span>
            <span className="cue-text">{c.text}</span>
            <button className="cue-edit" aria-label={`Edit cue at ${c.time}`}>
              <IconEdit width={14} height={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="captions-footer">
        <Button variant="secondary" full>+ Language</Button>
        <Button variant="primary" full>Save captions</Button>
      </div>
    </div>
  );
}
