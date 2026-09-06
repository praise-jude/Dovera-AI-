import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Mode, Screen, ViewState } from "./types";
import * as api from "./api";
import type { SlideshowStyle } from "./api";

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
  realJobId: null,
  realPending: false,
  realStatusMessage: null,
  realResultUrl: null,
  realError: null,
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
  startRealSlideshow: (opts: {
    projectName: string;
    images: File[];
    durations: number[];
    music: File | null;
    musicAssetId?: string;
    aspectRatio: "9:16" | "16:9" | "1:1";
    style: SlideshowStyle;
    titleText: string;
    endingText: string;
  }) => Promise<void>;
  viewProjectResult: (projectId: string) => Promise<void>;
  clearRealError: () => void;
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
  const pollTimer = useRef<number | null>(null);

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

  // Simulated flow: everything reachable through the original mockup's
  // Storyboard/Scene "Generate" CTA. No real backend involved.
  const confirmGenerate = useCallback(() => {
    setState((s) => ({
      ...s,
      sheet: false,
      prog: 0,
      realJobId: null,
      realPending: false,
      realError: null,
      realResultUrl: null,
      prevScreen: s.screen,
      screen: "generating",
    }));
  }, []);

  const clearRealError = useCallback(() => {
    setState((s) => ({ ...s, realError: null, realJobId: null }));
  }, []);

  // Opens a previously-generated project's video from the Projects screen —
  // no new job, just fetches the existing result asset.
  const viewProjectResult = useCallback(async (projectId: string) => {
    setState((s) => ({
      ...s,
      realResultUrl: null,
      realError: null,
      prevScreen: s.screen,
      screen: "result",
    }));
    try {
      await api.ensureAuth();
      const project = await api.getProject(projectId);
      const completedJob = project.jobs?.find((j) => j.status === "COMPLETED" && j.resultAssetId);
      if (!completedJob?.resultAssetId) {
        throw new Error("NO_RESULT");
      }
      const url = await api.fetchAssetBlobUrl(completedJob.resultAssetId);
      setState((s) => ({ ...s, realResultUrl: url }));
    } catch {
      setState((s) => ({ ...s, screen: "projects", realError: null }));
    }
  }, []);

  // Real flow: Photo Slideshow, backed by the live API.
  const startRealSlideshow = useCallback(
    async (opts: {
      projectName: string;
      images: File[];
      durations: number[];
      music: File | null;
      musicAssetId?: string;
      aspectRatio: "9:16" | "16:9" | "1:1";
      style: SlideshowStyle;
      titleText: string;
      endingText: string;
    }) => {
      // realPending is set synchronously, before any await, so the fake
      // progress-timer effect (gated on screen==="generating") never gets a
      // window to start racing against the real upload/generate sequence
      // below — uploads take a second or two, plenty of time for a 260ms
      // fake tick to fire first if this only flipped once realJobId existed.
      setState((s) => ({
        ...s,
        prog: 0,
        realJobId: null,
        realPending: true,
        realError: null,
        realResultUrl: null,
        realStatusMessage: "Setting up your project",
        prevScreen: s.screen,
        screen: "generating",
      }));
      try {
        await api.ensureAuth();
        const project = await api.createProject(opts.projectName || "Untitled slideshow");

        const imageAssetIds: string[] = [];
        for (const file of opts.images) {
          const asset = await api.uploadAsset(file, { projectId: project.id });
          imageAssetIds.push(asset.id);
        }
        // A library pick takes priority over a fresh upload if somehow both
        // are present (the UI only ever offers one or the other at a time).
        let musicAssetId: string | undefined = opts.musicAssetId;
        if (!musicAssetId && opts.music) {
          const asset = await api.uploadAsset(opts.music, { projectId: project.id, category: "MUSIC" });
          musicAssetId = asset.id;
        }

        const totalDur = opts.durations.reduce((a, b) => a + b, 0);
        const captions: { text: string; atSec: number; durationSec: number }[] = [];
        if (opts.titleText) {
          captions.push({ text: opts.titleText, atSec: 0.3, durationSec: Math.min(3, totalDur) });
        }
        if (opts.endingText) {
          captions.push({
            text: opts.endingText,
            atSec: Math.max(totalDur - 3, 0),
            durationSec: Math.min(3, totalDur),
          });
        }

        const { job } = await api.createSlideshowJob(project.id, {
          imageAssetIds,
          musicAssetId,
          durations: opts.durations,
          aspectRatio: opts.aspectRatio,
          style: opts.style,
          captions: captions.length ? captions : undefined,
        });

        setState((s) => ({ ...s, realJobId: job.id, realPending: false }));
      } catch (err) {
        setState((s) => ({
          ...s,
          realPending: false,
          realError: err instanceof api.ApiError ? err.message : "Couldn't start generation. Please try again.",
        }));
      }
    },
    []
  );

  // Fake progress driver — only runs when there's no real job in flight.
  useEffect(() => {
    if (state.screen !== "generating" || state.realJobId || state.realPending) return;
    genTimer.current = window.setInterval(() => {
      setState((s) => {
        if (s.screen !== "generating" || s.realJobId || s.realPending) return s;
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
  }, [state.screen, state.realJobId, state.realPending]);

  // Real progress driver — polls the live job while one is in flight.
  useEffect(() => {
    if (!state.realJobId) return;
    const jobId = state.realJobId;
    let cancelled = false;

    const tick = async () => {
      try {
        const job = await api.getJob(jobId);
        if (cancelled) return;
        if (job.status === "COMPLETED" && job.resultAssetId) {
          const url = await api.fetchAssetBlobUrl(job.resultAssetId);
          if (cancelled) return;
          const me = await api.getMe().catch(() => null);
          setState((s) => ({
            ...s,
            prog: 100,
            realResultUrl: url,
            credits: me ? me.credits.toLocaleString() : s.credits,
            screen: "result",
            prevScreen: "generating",
          }));
          return;
        }
        if (job.status === "FAILED") {
          setState((s) => ({ ...s, realError: job.error || "Generation failed. Your project is safe." }));
          return;
        }
        setState((s) => ({ ...s, prog: job.progress, realStatusMessage: job.statusMessage }));
        pollTimer.current = window.setTimeout(tick, 1000);
      } catch {
        if (!cancelled) {
          setState((s) => ({ ...s, realError: "Lost connection while generating. Please try again." }));
        }
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
    };
  }, [state.realJobId]);

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
    startRealSlideshow,
    viewProjectResult,
    clearRealError,
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
