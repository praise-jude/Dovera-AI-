import { useStore } from "../lib/store";
import { Button, Placeholder } from "../components/ui";
import { CHARACTERS } from "../lib/data";
import { IconPlus } from "../components/icons";

export function CharacterLock() {
  const { char, setChar } = useStore();

  return (
    <div className="screen character-screen vup">
      <div className="character-list">
        {CHARACTERS.map((c) => {
          const locked = char === c.name;
          return (
            <div key={c.id} className="character-row">
              <Placeholder className="character-avatar" />
              <div className="character-info">
                <div className="character-name">{c.name}</div>
                <div className="character-desc">{c.desc}</div>
              </div>
              <Button
                variant={locked ? "primary" : "secondary"}
                onClick={() => setChar(c.name)}
                className="character-lock-btn"
              >
                {locked ? "Locked" : "Lock"}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="new-character-panel">
        <div className="section-label">New character</div>
        <input className="text-input" placeholder="Name" aria-label="Character name" />
        <textarea
          className="textarea-input"
          placeholder="Appearance, clothing, hair, personality…"
          rows={3}
          aria-label="Character description"
        />
        <div className="ref-slots">
          {[0, 1, 2].map((i) => (
            <button key={i} className="ref-slot" aria-label="Add reference image">
              <IconPlus width={18} height={18} />
            </button>
          ))}
        </div>
        <p className="disclaimer-note" style={{ margin: "2px 0 0" }}>
          Reference upload requires a provider that supports character reference frames.
        </p>
        <Button variant="primary" full>Save character</Button>
      </div>
    </div>
  );
}
