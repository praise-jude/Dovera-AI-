import { StoreProvider, useStore } from "./lib/store";
import { Header, TabBar } from "./components/Chrome";
import { CreditSheet } from "./screens/CreditSheet";
import { Home } from "./screens/Home";
import { Director } from "./screens/Director";
import { Storyboard } from "./screens/Storyboard";
import { SceneEditor } from "./screens/SceneEditor";
import { CharacterLock } from "./screens/CharacterLock";
import { AdStudio } from "./screens/AdStudio";
import { ScriptToVideo } from "./screens/ScriptToVideo";
import { Templates } from "./screens/Templates";
import { PromptMagic } from "./screens/PromptMagic";
import { Generating } from "./screens/Generating";
import { Result } from "./screens/Result";
import { Formats } from "./screens/Formats";
import { VoiceStudio } from "./screens/VoiceStudio";
import { CaptionsStudio } from "./screens/CaptionsStudio";
import { Projects } from "./screens/Projects";
import { Slideshow } from "./screens/Slideshow";
import { MusicLibrary } from "./screens/MusicLibrary";
import type { FC } from "react";
import type { Screen } from "./lib/types";

const SCREEN_MAP: Record<Screen, FC> = {
  home: Home,
  director: Director,
  storyboard: Storyboard,
  scene: SceneEditor,
  character: CharacterLock,
  ad: AdStudio,
  script: ScriptToVideo,
  templates: Templates,
  magic: PromptMagic,
  generating: Generating,
  result: Result,
  formats: Formats,
  voice: VoiceStudio,
  captions: CaptionsStudio,
  projects: Projects,
  slideshow: Slideshow,
  "music-library": MusicLibrary,
};

// screens where the header/tab chrome is suppressed for a focused, full-bleed moment
const CHROMELESS: Screen[] = ["generating"];

function Shell() {
  const { screen, credits, back, go, realResultUrl } = useStore();
  const ScreenComponent = SCREEN_MAP[screen];
  const chromeless = CHROMELESS.includes(screen);
  const subtitleOverride = screen === "result" && realResultUrl ? "Your slideshow · real render" : undefined;

  return (
    <div className="app-root">
      <div className="app-frame">
        {!chromeless && (
          <Header
            screen={screen}
            credits={credits}
            onBack={back}
            showBack={screen !== "home"}
            subtitleOverride={subtitleOverride}
          />
        )}
        <main className={`app-main ${chromeless ? "app-main-full" : ""}`}>
          <ScreenComponent key={screen} />
        </main>
        {!chromeless && <TabBar active={screen} onSelect={go} />}
        <CreditSheet />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
