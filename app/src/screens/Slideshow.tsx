import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { Button, Chip } from "../components/ui";
import { IconClose } from "../components/icons";
import * as api from "../lib/api";
import type { SlideshowStyle, UploadedAsset } from "../lib/api";

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

function formatDuration(sec: number | null): string {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function Slideshow() {
  const { startRealSlideshow } = useStore();
  const [images, setImages] = useState<File[]>([]);
  const [durations, setDurations] = useState<number[]>([]);
  const [music, setMusic] = useState<File | null>(null);
  const [uploadedMusicDuration, setUploadedMusicDuration] = useState<number | null>(null);
  const [libraryMusic, setLibraryMusic] = useState<UploadedAsset[]>([]);
  const [pickedMusicId, setPickedMusicId] = useState<string | null>(null);
  const [syncToMusic, setSyncToMusic] = useState(false);
  const [aspect, setAspect] = useState<"9:16" | "16:9" | "1:1">("9:16");
  const [style, setStyle] = useState<SlideshowStyle>("kenburns");
  const [titleText, setTitleText] = useState("");
  const [endingText, setEndingText] = useState("");
  const [name, setName] = useState("");
  const imgInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .ensureAuth()
      .then(() => api.listLibrary({ kind: "AUDIO", category: "MUSIC" }))
      .then(setLibraryMusic)
      .catch(() => {});
  }, []);

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

  const musicDurationSec = pickedMusicId
    ? libraryMusic.find((m) => m.id === pickedMusicId)?.durationSec ?? null
    : uploadedMusicDuration;

  const canSync = Boolean(musicDurationSec) && images.length > 0;

  const addImages = (files: File[]) => {
    setImages((imgs) => [...imgs, ...files].slice(0, 12));
    setDurations((d) => [...d, ...files.map(() => DEFAULT_DURATION)].slice(0, 12));
  };

  const removeImage = (i: number) => {
    setImages((imgs) => imgs.filter((_, idx) => idx !== i));
    setDurations((d) => d.filter((_, idx) => idx !== i));
  };

  const moveImage = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    setImages((imgs) => {
      const next = [...imgs];
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

  const effectiveDurations =
    syncToMusic && musicDurationSec && images.length > 0
      ? images.map(() => Math.max(MIN_DURATION, Math.min(MAX_DURATION, musicDurationSec / images.length)))
      : durations;

  const totalDuration = effectiveDurations.reduce((a, b) => a + b, 0);
  const canGenerate = images.length > 0;

  return (
    <div className="screen slideshow-screen vup">
      <div className="real-badge">
        <span className="real-badge-dot" /> Real generation — this actually renders on our server
      </div>

      <p className="disclaimer-note" style={{ margin: "10px 2px 16px" }}>
        Upload your own photos (and optionally your own music) and VIDORA assembles a real slideshow
        video — no placeholder, no simulation.
      </p>

      <input
        className="text-input"
        placeholder="Project name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ marginBottom: 16 }}
      />

      <div className="section-label" style={{ marginTop: 0 }}>
        Photos {images.length > 0 && <span className="mono">· {totalDuration.toFixed(1)}s total</span>}
      </div>

      {images.length > 0 && (
        <div className="slideshow-photo-list">
          {images.map((file, i) => (
            <div key={i} className="slideshow-photo-row">
              <img className="slideshow-photo-row-thumb" src={URL.createObjectURL(file)} alt={`Photo ${i + 1}`} />
              <div className="slideshow-photo-row-info">
                <span className="mono slideshow-photo-row-num">{String(i + 1).padStart(2, "0")}</span>
                {!syncToMusic ? (
                  <div className="slideshow-duration-stepper">
                    <button aria-label="Shorter" onClick={() => adjustDuration(i, -0.5)}>−</button>
                    <span className="mono">{effectiveDurations[i]?.toFixed(1)}s</span>
                    <button aria-label="Longer" onClick={() => adjustDuration(i, 0.5)}>+</button>
                  </div>
                ) : (
                  <span className="mono slideshow-synced-duration">{effectiveDurations[i]?.toFixed(1)}s · synced</span>
                )}
              </div>
              <div className="slideshow-photo-row-actions">
                <button disabled={i === 0} onClick={() => moveImage(i, -1)} aria-label={`Move photo ${i + 1} up`}>▲</button>
                <button disabled={i === images.length - 1} onClick={() => moveImage(i, 1)} aria-label={`Move photo ${i + 1} down`}>▼</button>
                <button onClick={() => removeImage(i)} aria-label={`Remove photo ${i + 1}`}>
                  <IconClose width={13} height={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length < 12 && (
        <button className="add-scene-btn" style={{ marginTop: images.length > 0 ? 10 : 0 }} onClick={() => imgInputRef.current?.click()}>
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

      <div className="section-label">Music (optional)</div>

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

      {(music || pickedMusicId) && (
        <button
          className={`sync-toggle-row ${syncToMusic ? "sync-toggle-row-active" : ""}`}
          onClick={() => setSyncToMusic((v) => !v)}
          disabled={!canSync}
        >
          <span className={`sync-toggle-box ${syncToMusic ? "sync-toggle-box-active" : ""}`}>{syncToMusic ? "✓" : ""}</span>
          <span>
            Sync photos to music
            {musicDurationSec != null && (
              <span className="disclaimer-note" style={{ display: "block", marginTop: 2 }}>
                Splits {formatDuration(musicDurationSec)} evenly across {images.length || "your"} photo{images.length === 1 ? "" : "s"}
              </span>
            )}
          </span>
        </button>
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
            images,
            durations: effectiveDurations,
            music,
            musicAssetId: pickedMusicId ?? undefined,
            aspectRatio: aspect,
            style,
            titleText,
            endingText,
          })
        }
      >
        {canGenerate ? `Generate real video (${images.length} photo${images.length === 1 ? "" : "s"})` : "Add at least one photo"}
      </Button>
    </div>
  );
}
