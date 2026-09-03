import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Mode, Screen, ViewState } from "./types";

const initialState: ViewState = {
  screen: "home",
  prevScreen: "home",
  mode: "Director",
  chat: 1,
  answerPicked: null,
  cam: "Dolly Shot",
  adStyle: "Luxury",
  cap: "Bold Social",
  voice: "Amara",
  char: "Sarah",
  fmt: ["tiktok", "shorts"],
  sheet: false,
  prog: 0,
  credits: "1,240",
  activeSceneId: 2,
};

interface Store extends ViewState {
  go: (screen: Screen) => void;
  back: () => void;
  setMode: (mode: Mode) => void;
  pickAnswer: (chip: string) => void;
  setCam: (cam: string) => void;
  setAdStyle: (style: string) => void;
  setCap: (cap: string) => void;
  setVoice: (voice: string) => void;
  setChar: (char: string) => void;
  toggleFmt: (id: string) => void;
  openSheet: () => void;
  closeSheet: () => void;
  confirmGenerate: () => void;
  openScene: (id: number) => void;
}

const StoreCtx = createContext<Store | null>(null);

// back-button target per screen, per README: "back button → Storyboard from Scene, otherwise Home"
function backTarget(screen: Screen): Screen {
  if (screen === "scene") return "storyboard";
  return "home";
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ViewState>(initialState);
  const genTimer = useRef<number | null>(null);

  const go = useCallback((screen: Screen) => {
    setState((s) => (s.screen === screen ? s : { ...s, prevScreen: s.screen, screen }));
  }, []);

  const back = useCallback(() => {
    setState((s) => ({ ...s, screen: backTarget(s.screen), prevScreen: s.screen }));
  }, []);

  const setMode = useCallback((mode: Mode) => setState((s) => ({ ...s, mode })), []);

  const pickAnswer = useCallback((chip: string) => {
    setState((s) => ({ ...s, answerPicked: chip, chat: 2 }));
  }, []);

  const setCam = useCallback((cam: string) => setState((s) => ({ ...s, cam })), []);
  const setAdStyle = useCallback((adStyle: string) => setState((s) => ({ ...s, adStyle })), []);
  const setCap = useCallback((cap: string) => setState((s) => ({ ...s, cap })), []);
  const setVoice = useCallback((voice: string) => setState((s) => ({ ...s, voice })), []);
  const setChar = useCallback((char: string) => setState((s) => ({ ...s, char })), []);
  const toggleFmt = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      fmt: s.fmt.includes(id) ? s.fmt.filter((f) => f !== id) : [...s.fmt, id],
    }));
  }, []);

  const openSheet = useCallback(() => setState((s) => ({ ...s, sheet: true })), []);
  const closeSheet = useCallback(() => setState((s) => ({ ...s, sheet: false })), []);

  const openScene = useCallback((id: number) => {
    setState((s) => ({ ...s, activeSceneId: id, prevScreen: s.screen, screen: "scene" }));
  }, []);

  const confirmGenerate = useCallback(() => {
    setState((s) => ({ ...s, sheet: false, prog: 0, prevScreen: s.screen, screen: "generating" }));
  }, []);

  useEffect(() => {
    if (state.screen !== "generating") return;
    genTimer.current = window.setInterval(() => {
      setState((s) => {
        if (s.screen !== "generating") return s;
        const next = Math.min(100, s.prog + 9);
        if (next >= 100) {
          if (genTimer.current) window.clearInterval(genTimer.current);
          return { ...s, prog: 100, credits: "1,199", screen: "result", prevScreen: "generating" };
        }
        return { ...s, prog: next };
      });
    }, 260);
    return () => {
      if (genTimer.current) window.clearInterval(genTimer.current);
    };
  }, [state.screen]);

  const value: Store = {
    ...state,
    go,
    back,
    setMode,
    pickAnswer,
    setCam,
    setAdStyle,
    setCap,
    setVoice,
    setChar,
    toggleFmt,
    openSheet,
    closeSheet,
    confirmGenerate,
    openScene,
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
