import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { Button, Chip } from "../components/ui";
import { IconClose } from "../components/icons";
import * as api from "../lib/api";
import type { SlideshowStyle, UploadedAsset } from "../lib/api";
import { detectBeats, beatAlignedDurations, type BeatInfo } from "../lib/beatDetect";
import { deriveFromPrompt } from "../lib/promptDefaults";
import { decodeWaveformFromFile, decodeWaveformFromUrl, type WaveformData } from "../lib/waveform";
import { Waveform } from "../components/Waveform";

const ASPECTS: { id: "9:16" | "16:9" | "1:1"; label: string }[] = [
  { id: "9:16", label: "9:16 Vertical" },
  { id: "16:9", label: "16:9 Landscape" },
  { id: "1:1", label: "1:1 Square" },
];

const STYLES: { id: SlideshowStyle; label: string; meta: string }[] = [
  { id: "kenburns", label: "Ken Burns", meta: "Slow steady zoom" },
  { id: "cinematic", label: "Cinematic", meta: "Muted tones, vignette" },
  { id: "vibrant", label: "Vibrant", meta: "Bold color, faster zoom" },
  { id: "classic", label: "Classic", meta: "Static frames, hard cuts" },
];

const DEFAULT_DURATION = 3;
const MIN_DURATION = 1;
const MAX_DURATION = 10;

type TimingMode = "manual" | "sync" | "beat";

// A photo already on the server (from an edited/duplicated project) doesn't
// need re-uploading — only a fresh pick does. Keeping both kinds in one
// ordered list lets you freely add, remove, and reorder a mix of the two.
type PhotoItem =
  | { key: string; kind: "new"; file: File }
  | { key: string; kind: "existing"; assetId: string; url: string };

function formatDuration(sec: number | null): string {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function shuffle<T>(arr: T[]): T[] {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

interface AddedSfx {
  assetId: string;
  atSec: number;
  filename: string;
}

export function Slideshow() {
  const { startRealSlideshow, editProjectId, clearEditProject } = useStore();
  const [idea, setIdea] = useState("");
  const [ideaApplied, setIdeaApplied] = useState(false);

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [durations, setDurations] = useState<number[]>([]);
  const [music, setMusic] = useState<File | null>(null);
  const [uploadedMusicDuration, setUploadedMusicDuration] = useState<number | null>(null);
  const [libraryMusic, setLibraryMusic] = useState<UploadedAsset[]>([]);
  const [pickedMusicId, setPickedMusicId] = useState<string | null>(null);
  const [timingMode, setTimingMode] = useState<TimingMode>("manual");
  const [beatInfo, setBeatInfo] = useState<BeatInfo | null>(null);
  const [beatDetecting, setBeatDetecting] = useState(false);
  const [beatError, setBeatError] = useState<string | null>(null);
  const [musicVolume, setMusicVolume] = useState(0.9);
  const [musicStartSec, setMusicStartSec] = useState(0);
  const [waveform, setWaveform] = useState<WaveformData | null>(null);
  const [waveformLoading, setWaveformLoading] = useState(false);
  const [librarySfx, setLibrarySfx] = useState<UploadedAsset[]>([]);
  const [sfxPickId, setSfxPickId] = useState<string | null>(null);
  const [sfxAtSec, setSfxAtSec] = useState(0);
  const [soundEffects, setSoundEffects] = useState<AddedSfx[]>([]);
  const [aspect, setAspect] = useState<"9:16" | "16:9" | "1:1">("9:16");
  const [style, setStyle] = useState<SlideshowStyle>("kenburns");
  const [titleText, setTitleText] = useState("");
  const [endingText, setEndingText] = useState("");
  const [name, setName] = useState("");
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [editNotice, setEditNotice] = useState<string | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .ensureAuth()
      .then(() => api.listLibrary({ kind: "AUDIO", category: "MUSIC" }))
      .then(setLibraryMusic)
      .catch(() => {});
    api
      .ensureAuth()
      .then(() => api.listLibrary({ kind: "AUDIO", category: "SFX" }))
      .then(setLibrarySfx)
      .catch(() => {});
  }, []);

  // Prefill everything from a past project's last completed render — this
  // never touches or re-renders that project; submitting still creates a
  // brand-new one, so the original stays exactly as it was.
  useEffect(() => {
    if (!editProjectId) return;
    const projectId = editProjectId;
    clearEditProject();
    setLoadingEdit(true);
    (async () => {
      try {
        await api.ensureAuth();
        const project = await api.getProject(projectId);
        const job = project.jobs?.find((j) => j.type === "SLIDESHOW_VIDEO" && j.status === "COMPLETED");
        if (!job) {
          setEditNotice("Couldn't find a finished render to copy from that project.");
          return;
        }
        const params = job.params as api.SlideshowJobParams;

        setName(`${project.name} (copy)`);
        setPhotos(
          (params.imageAssetIds ?? []).map((assetId) => ({
            key: crypto.randomUUID(),
            kind: "existing" as const,
            assetId,
            url: api.getAssetFileUrl(assetId),
          }))
        );
        setDurations(params.durations ?? (params.imageAssetIds ?? []).map(() => DEFAULT_DURATION));
        setTimingMode("manual");
        if (params.musicAssetId) {
          // The music-changed effect below would otherwise immediately
          // reset the trim point it's about to see set two lines down.
          skipNextTrimReset.current = true;
          setPickedMusicId(params.musicAssetId);
          setMusic(null);
        }
        setMusicVolume(params.musicVolume ?? 0.9);
        setMusicStartSec(params.musicStartSec ?? 0);
        if (params.aspectRatio) setAspect(params.aspectRatio);
        if (params.style) setStyle(params.style);
        if (params.soundEffects?.length) {
          setSoundEffects(
            params.soundEffects.map((sfx) => ({
              assetId: sfx.assetId,
              atSec: sfx.atSec,
              filename: librarySfx.find((s) => s.id === sfx.assetId)?.filename ?? "Sound effect",
            }))
          );
        }
        if (params.captions?.length) {
          const sorted = [...params.captions].sort((a, b) => a.atSec - b.atSec);
          setTitleText(sorted[0]?.text ?? "");
          if (sorted.length > 1) setEndingText(sorted[sorted.length - 1]?.text ?? "");
        }
        setEditNotice(`Copied settings from "${project.name}" — change anything, then generate.`);
      } catch {
        setEditNotice("Couldn't load that project's settings. Starting from scratch.");
      } finally {
        setLoadingEdit(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editProjectId]);

  // Decode the uploaded music file's real duration client-side (no upload
  // needed yet) so "sync to music" works for a fresh file, not just a saved
  // library pick that already carries a server-computed duration.
  useEffect(() => {
    if (!music) {
      setUploadedMusicDuration(null);
      return;
    }
    const url = URL.createObjectURL(music);
    const audio = new Audio(url);
    const onLoaded = () => setUploadedMusicDuration(audio.duration);
    audio.addEventListener("loadedmetadata", onLoaded);
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      URL.revokeObjectURL(url);
    };
  }, [music]);

  // Beat info and the trim point are both tied to a specific track — clear
  // them whenever the selected music changes so stale state never gets
  // applied to a new song. (Edit-prefill sets its own trim point above,
  // right before this would otherwise reset it back to 0 — see guard.)
  const skipNextTrimReset = useRef(false);
  useEffect(() => {
    setBeatInfo(null);
    setBeatError(null);
    if (skipNextTrimReset.current) {
      skipNextTrimReset.current = false;
    } else {
      setMusicStartSec(0);
    }
    if (timingMode === "beat") setTimingMode("sync");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [music, pickedMusicId]);

  // Real waveform, decoded from the actual audio — a fresh upload decodes
  // the local file directly; a library pick fetches the same authenticated
  // URL the player uses. Never fabricated: silence renders as a flat line.
  useEffect(() => {
    let cancelled = false;
    setWaveform(null);
    if (!music && !pickedMusicId) return;
    setWaveformLoading(true);
    const task = music
      ? decodeWaveformFromFile(music)
      : decodeWaveformFromUrl(api.getAssetFileUrl(pickedMusicId!));
    task.then((data) => {
      if (!cancelled) {
        setWaveform(data);
        setWaveformLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [music, pickedMusicId]);

  const musicDurationSec = pickedMusicId
    ? libraryMusic.find((m) => m.id === pickedMusicId)?.durationSec ?? null
    : uploadedMusicDuration;

  const canSync = Boolean(musicDurationSec) && photos.length > 0;
  const suggestedPhotoCount = musicDurationSec ? Math.max(1, Math.round(musicDurationSec / DEFAULT_DURATION)) : null;

  const runBeatDetection = async () => {
    const file = music;
    if (!file) return;
    setBeatDetecting(true);
    setBeatError(null);
    const info = await detectBeats(file);
    setBeatDetecting(false);
    if (!info) {
      setBeatError("Couldn't find a clear beat in this track — using even timing instead.");
      setTimingMode("sync");
      return;
    }
    setBeatInfo(info);
    setTimingMode("beat");
  };

  const addImages = (files: File[]) => {
    const items: PhotoItem[] = files.map((file) => ({ key: crypto.randomUUID(), kind: "new", file }));
    setPhotos((ps) => [...ps, ...items].slice(0, 12));
    setDurations((d) => [...d, ...files.map(() => DEFAULT_DURATION)].slice(0, 12));
  };

  const removeImage = (i: number) => {
    setPhotos((ps) => ps.filter((_, idx) => idx !== i));
    setDurations((d) => d.filter((_, idx) => idx !== i));
  };

  const moveImage = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= photos.length) return;
    setPhotos((ps) => {
      const next = [...ps];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDurations((d) => {
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const adjustDuration = (i: number, delta: number) => {
    setDurations((d) => d.map((v, idx) => (idx === i ? Math.max(MIN_DURATION, Math.min(MAX_DURATION, v + delta)) : v)));
  };

  const surpriseMe = () => {
    if (photos.length === 0) return;
    const order = shuffle(photos.map((_, i) => i));
    setPhotos((ps) => order.map((i) => ps[i]));
    setDurations((d) => order.map((i) => d[i] ?? DEFAULT_DURATION));
    setStyle(STYLES[Math.floor(Math.random() * STYLES.length)].id);
    setTimingMode("manual");
  };

  const applyIdea = () => {
    if (!idea.trim()) return;
    const derived = deriveFromPrompt(idea);
    setStyle(derived.style);
    setTitleText(derived.title);
    if (timingMode === "manual") {
      setDurations((d) => d.map(() => derived.secondsPerImage));
    }
    setIdeaApplied(true);
  };

  const effectiveDurations =
    timingMode === "sync" && musicDurationSec && photos.length > 0
      ? photos.map(() => Math.max(MIN_DURATION, Math.min(MAX_DURATION, musicDurationSec / photos.length)))
      : timingMode === "beat" && beatInfo && photos.length > 0
        ? beatAlignedDurations(photos.length, beatInfo, musicDurationSec ?? durations.reduce((a, b) => a + b, 0), MIN_DURATION, MAX_DURATION)
        : durations;

  const totalDuration = effectiveDurations.reduce((a, b) => a + b, 0);
  const canGenerate = photos.length > 0;

  return (
    <div className="screen slideshow-screen vup">
      <div className="real-badge">
        <span className="real-badge-dot" /> Real generation — this actually renders on our server
      </div>

      <p className="disclaimer-note" style={{ margin: "10px 2px 16px" }}>
        Upload your own photos (and optionally your own music) and VIDORA assembles a real slideshow
        video — no placeholder, no simulation.
      </p>

      {loadingEdit && <p className="disclaimer-note" style={{ margin: "0 2px 16px" }}>Loading that project's settings…</p>}
      {editNotice && !loadingEdit && (
        <p className="disclaimer-note" style={{ margin: "0 2px 16px", color: "var(--accent)" }}>{editNotice}</p>
      )}

      <div className="section-label" style={{ marginTop: 0 }}>Idea (optional)</div>
      <input
        className="text-input"
        placeholder="e.g. romantic wedding highlight, energetic travel reel…"
        value={idea}
        onChange={(e) => {
          setIdea(e.target.value.slice(0, 120));
          setIdeaApplied(false);
        }}
        style={{ marginBottom: 8 }}
      />
      <Button variant="secondary" full disabled={!idea.trim()} onClick={applyIdea} style={{ marginBottom: 6 }}>
        {ideaApplied ? "Applied ✓" : "Apply to style, pacing & title"}
      </Button>
      <p className="disclaimer-note" style={{ margin: "0 2px 16px" }}>
        Smart defaults from keywords in what you type — not an AI that understands your photos.
      </p>

      <input
        className="text-input"
        placeholder="Project name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ marginBottom: 16 }}
      />

      <div className="section-label" style={{ marginTop: 0 }}>Music (optional — start here if you'd like)</div>

      {libraryMusic.length > 0 && (
        <>
          <div className="disclaimer-note" style={{ margin: "0 2px 8px" }}>Use my music</div>
          <div className="suggestion-row" style={{ marginBottom: 10 }}>
            {libraryMusic.map((m) => (
              <Chip
                key={m.id}
                selected={pickedMusicId === m.id}
                onClick={() => {
                  setMusic(null);
                  setPickedMusicId((cur) => (cur === m.id ? null : m.id));
                }}
              >
                {m.filename} {formatDuration(m.durationSec) && `· ${formatDuration(m.durationSec)}`}
              </Chip>
            ))}
          </div>
        </>
      )}

      {music ? (
        <div className="music-picked-row">
          <span className="music-picked-name">
            {music.name} {uploadedMusicDuration != null && `· ${formatDuration(uploadedMusicDuration)}`}
          </span>
          <button className="link-btn" onClick={() => setMusic(null)}>Remove</button>
        </div>
      ) : (
        <Button
          variant="secondary"
          full
          onClick={() => musicInputRef.current?.click()}
          disabled={Boolean(pickedMusicId)}
        >
          + Upload new music file
        </Button>
      )}
      <input
        ref={musicInputRef}
        type="file"
        accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/flac"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) {
            setMusic(file);
            setPickedMusicId(null);
          }
        }}
      />

      {musicDurationSec != null && photos.length === 0 && (
        <p className="disclaimer-note" style={{ margin: "10px 2px 0" }}>
          {formatDuration(musicDurationSec)} track — try around {suggestedPhotoCount} photo
          {suggestedPhotoCount === 1 ? "" : "s"} for a good pace (about {DEFAULT_DURATION}s each).
        </p>
      )}

      {(music || pickedMusicId) && (
        <>
          <div className="section-label">Music start point</div>
          {waveformLoading && <p className="disclaimer-note" style={{ margin: "0 2px 8px" }}>Reading the waveform…</p>}
          {!waveformLoading && waveform && waveform.durationSec > 0 && (
            <>
              <Waveform
                peaks={waveform.peaks}
                durationSec={waveform.durationSec}
                trimStartSec={musicStartSec}
                usedSec={Math.max(1, totalDuration)}
                onChangeTrimStart={setMusicStartSec}
              />
              <div className="waveform-caption">
                <span>Starts at {formatDuration(musicStartSec)}</span>
                <span>Track is {formatDuration(waveform.durationSec)}</span>
              </div>
              <p className="disclaimer-note" style={{ margin: "8px 2px 0" }}>
                Drag to skip a quiet intro — the highlighted band is what actually plays.
              </p>
            </>
          )}
          {!waveformLoading && !waveform && (
            <p className="disclaimer-note" style={{ margin: "0 2px 16px" }}>
              Couldn't read this track's waveform — it'll still play from the start.
            </p>
          )}

          <div className="section-label">Photo timing</div>
          <div className="style-chip-row">
            <Chip selected={timingMode === "manual"} onClick={() => setTimingMode("manual")}>Manual</Chip>
            <Chip selected={timingMode === "sync"} onClick={() => setTimingMode("sync")} disabled={!canSync}>
              Even split
            </Chip>
            <Chip
              selected={timingMode === "beat"}
              onClick={() => (beatInfo ? setTimingMode("beat") : runBeatDetection())}
              disabled={!canSync || beatDetecting}
            >
              {beatDetecting ? "Detecting…" : "On the beat"}
            </Chip>
          </div>
          {timingMode === "sync" && musicDurationSec != null && (
            <p className="disclaimer-note" style={{ margin: "8px 2px 0" }}>
              Splits {formatDuration(musicDurationSec)} evenly across {photos.length || "your"} photo
              {photos.length === 1 ? "" : "s"}.
            </p>
          )}
          {timingMode === "beat" && beatInfo && (
            <p className="disclaimer-note" style={{ margin: "8px 2px 0" }}>
              Detected ~{beatInfo.bpm} BPM ({beatInfo.beatCount} beats found) — cuts land on the beat.
            </p>
          )}
          {beatError && <p className="disclaimer-note" style={{ color: "var(--warn)", margin: "8px 2px 0" }}>{beatError}</p>}

          <div className="section-label">Music volume</div>
          <div className="voice-slider-row" style={{ marginBottom: 4 }}>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={musicVolume}
              onChange={(e) => setMusicVolume(Number(e.target.value))}
              className="voice-slider"
              aria-label="Music volume"
            />
            <span className="mono">{musicVolume.toFixed(2)}×</span>
          </div>
        </>
      )}

      {librarySfx.length > 0 && (
        <>
          <div className="section-label">Sound effects (optional)</div>
          <p className="disclaimer-note" style={{ margin: "0 2px 8px" }}>
            Pick one from My Music &amp; Sounds, choose when it plays, then add it.
          </p>
          <div className="suggestion-row" style={{ marginBottom: 10 }}>
            {librarySfx.map((s) => (
              <Chip key={s.id} selected={sfxPickId === s.id} onClick={() => setSfxPickId((cur) => (cur === s.id ? null : s.id))}>
                {s.filename}
              </Chip>
            ))}
          </div>
          {sfxPickId && (
            <div className="sfx-add-row">
              <span className="disclaimer-note" style={{ margin: 0 }}>at</span>
              <input
                type="number"
                className="text-input sfx-at-input"
                min={0}
                step={0.5}
                value={sfxAtSec}
                onChange={(e) => setSfxAtSec(Math.max(0, Number(e.target.value)))}
              />
              <span className="disclaimer-note" style={{ margin: 0 }}>sec</span>
              <Button
                variant="secondary"
                onClick={() => {
                  const asset = librarySfx.find((s) => s.id === sfxPickId);
                  if (!asset) return;
                  setSoundEffects((list) => [...list, { assetId: asset.id, atSec: sfxAtSec, filename: asset.filename }]);
                  setSfxPickId(null);
                  setSfxAtSec(0);
                }}
              >
                Add
              </Button>
            </div>
          )}
          {soundEffects.length > 0 && (
            <div className="slideshow-photo-list" style={{ marginBottom: 10 }}>
              {soundEffects.map((sfx, i) => (
                <div key={i} className="slideshow-photo-row">
                  <div className="slideshow-photo-row-info" style={{ paddingLeft: 4 }}>
                    <span className="mono">{sfx.filename}</span>
                    <span className="mono slideshow-synced-duration">at {sfx.atSec.toFixed(1)}s</span>
                  </div>
                  <button
                    className="library-icon-btn library-icon-btn-danger"
                    aria-label={`Remove ${sfx.filename}`}
                    onClick={() => setSoundEffects((list) => list.filter((_, idx) => idx !== i))}
                  >
                    <IconClose width={13} height={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="section-label">
        Photos {photos.length > 0 && <span className="mono">· {totalDuration.toFixed(1)}s total</span>}
      </div>

      {photos.length > 0 && (
        <div className="slideshow-photo-list">
          {photos.map((photo, i) => (
            <div key={photo.key} className="slideshow-photo-row">
              <img
                className="slideshow-photo-row-thumb"
                src={photo.kind === "new" ? URL.createObjectURL(photo.file) : photo.url}
                alt={`Photo ${i + 1}`}
              />
              <div className="slideshow-photo-row-info">
                <span className="mono slideshow-photo-row-num">{String(i + 1).padStart(2, "0")}</span>
                {timingMode === "manual" ? (
                  <div className="slideshow-duration-stepper">
                    <button aria-label="Shorter" onClick={() => adjustDuration(i, -0.5)}>−</button>
                    <span className="mono">{effectiveDurations[i]?.toFixed(1)}s</span>
                    <button aria-label="Longer" onClick={() => adjustDuration(i, 0.5)}>+</button>
                  </div>
                ) : (
                  <span className="mono slideshow-synced-duration">
                    {effectiveDurations[i]?.toFixed(1)}s · {timingMode === "beat" ? "on the beat" : "synced"}
                  </span>
                )}
              </div>
              <div className="slideshow-photo-row-actions">
                <button disabled={i === 0} onClick={() => moveImage(i, -1)} aria-label={`Move photo ${i + 1} up`}>▲</button>
                <button disabled={i === photos.length - 1} onClick={() => moveImage(i, 1)} aria-label={`Move photo ${i + 1} down`}>▼</button>
                <button onClick={() => removeImage(i)} aria-label={`Remove photo ${i + 1}`}>
                  <IconClose width={13} height={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {photos.length < 12 && (
        <button className="add-scene-btn" style={{ marginTop: photos.length > 0 ? 10 : 0 }} onClick={() => imgInputRef.current?.click()}>
          + Add photos
        </button>
      )}
      <input
        ref={imgInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          addImages(files);
        }}
      />

      {photos.length > 1 && (
        <Button variant="secondary" full onClick={surpriseMe} style={{ marginTop: 10 }}>
          🎲 Surprise me — shuffle order &amp; style
        </Button>
      )}

      <div className="section-label">Style</div>
      <div className="camera-grid">
        {STYLES.map((s) => (
          <Chip key={s.id} selected={style === s.id} onClick={() => setStyle(s.id)} className="camera-chip">
            {s.label}
          </Chip>
        ))}
      </div>
      <div className="disclaimer-note" style={{ margin: "6px 2px 0" }}>
        {STYLES.find((s) => s.id === style)?.meta}
      </div>

      <div className="section-label">Aspect ratio</div>
      <div className="style-chip-row">
        {ASPECTS.map((a) => (
          <Chip key={a.id} selected={aspect === a.id} onClick={() => setAspect(a.id)}>
            {a.label}
          </Chip>
        ))}
      </div>

      <div className="section-label">Title (optional, shown at the start)</div>
      <input
        className="text-input"
        placeholder="e.g. My Amazing Journey"
        value={titleText}
        onChange={(e) => setTitleText(e.target.value.slice(0, 80))}
        style={{ marginBottom: 14 }}
      />

      <div className="section-label" style={{ marginTop: 0 }}>Ending text (optional)</div>
      <input
        className="text-input"
        placeholder="e.g. Thanks for watching"
        value={endingText}
        onChange={(e) => setEndingText(e.target.value.slice(0, 80))}
        style={{ marginBottom: 18 }}
      />

      <Button
        variant="primary"
        full
        disabled={!canGenerate}
        onClick={() =>
          startRealSlideshow({
            projectName: name,
            photos: photos.map((p) => (p.kind === "new" ? { kind: "new", file: p.file } : { kind: "existing", assetId: p.assetId })),
            durations: effectiveDurations,
            musicAssetId: pickedMusicId ?? undefined,
            music,
            musicVolume: music || pickedMusicId ? musicVolume : undefined,
            musicStartSec: music || pickedMusicId ? musicStartSec : undefined,
            soundEffects: soundEffects.length
              ? soundEffects.map(({ assetId, atSec }) => ({ assetId, atSec }))
              : undefined,
            aspectRatio: aspect,
            style,
            titleText,
            endingText,
          })
        }
      >
        {canGenerate ? `Generate real video (${photos.length} photo${photos.length === 1 ? "" : "s"})` : "Add at least one photo"}
      </Button>
    </div>
  );
}
