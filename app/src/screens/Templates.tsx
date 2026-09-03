import { useStore } from "../lib/store";
import { Placeholder } from "../components/ui";
import { TEMPLATES } from "../lib/data";

export function Templates() {
  const { go } = useStore();

  return (
    <div className="screen templates-screen vup">
      <div className="template-grid">
        {TEMPLATES.map((t) => (
          <button key={t.id} className="template-card" onClick={() => go("storyboard")}>
            <Placeholder ratio={t.ratio} className="template-thumb" />
            <div className="template-name">{t.name}</div>
            <div className="template-meta">{t.meta}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
