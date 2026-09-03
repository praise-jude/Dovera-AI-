import type { ComponentType, SVGProps } from "react";
import { SCREEN_META } from "../lib/data";
import type { Screen } from "../lib/types";
import { CreditPill } from "./ui";
import { IconBack, IconCreate, IconProjects, IconTemplates, IconStudio } from "./icons";

export function Header({
  screen,
  credits,
  onBack,
  showBack,
}: {
  screen: Screen;
  credits: string;
  onBack: () => void;
  showBack: boolean;
}) {
  const meta = SCREEN_META[screen];
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-header-left">
          {showBack ? (
            <button className="header-back" onClick={onBack} aria-label="Back">
              <IconBack />
            </button>
          ) : (
            <div className="header-back-spacer" />
          )}
          <div className="header-titles">
            <div className="header-title">{meta.title}</div>
            <div className="header-subtitle">{meta.subtitle}</div>
          </div>
        </div>
        <CreditPill credits={credits} />
      </div>
    </header>
  );
}

const TABS: { id: "home" | "projects" | "templates" | "result"; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "home", label: "Create", icon: IconCreate },
  { id: "projects", label: "Projects", icon: IconProjects },
  { id: "templates", label: "Templates", icon: IconTemplates },
  { id: "result", label: "Studio", icon: IconStudio },
];

export function TabBar({ active, onSelect }: { active: Screen; onSelect: (s: Screen) => void }) {
  const activeTab =
    active === "home" ? "home" :
    active === "projects" ? "projects" :
    active === "templates" ? "templates" :
    ["result", "voice", "captions", "formats", "storyboard", "scene"].includes(active) ? "result" :
    null;

  return (
    <nav className="app-tabbar" aria-label="Primary">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            className={`tab-item ${isActive ? "tab-item-active" : ""}`}
            onClick={() => onSelect(tab.id)}
            aria-current={isActive ? "page" : undefined}
          >
            <span className={`tab-icon ${tab.id === "result" ? "tab-icon-circle" : ""}`}>
              <Icon width={16} height={16} />
            </span>
            <span className="tab-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
