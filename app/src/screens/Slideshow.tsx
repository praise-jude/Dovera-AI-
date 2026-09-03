import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { Button, Chip } from "../components/ui";
import { IconPlus, IconClose } from "../components/icons";
import * as api from "../lib/api";
import type { UploadedAsset } from "../lib/api";

const ASPECTS: { id: "9:16" | "16:9" | "1:1"; label: string }[] = [
  { id: "9:16", label: "9:16 Vertical" },
  { id: "16:9", label: "16:9 Landscape" },
  { id: "1:1", label: "1:1 Square" },
];

function formatDuration(sec: number | null): string {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function Slideshow() {
  const { startRealSlideshow } = useStore();
  const [images, setImages] = useState<File[]>([]);
  const [music, setMusic] = useState<File | null>(null);
  const [libraryMusic, setLibraryMusic] = useState<UploadedAsset[]>([]);
  const [pickedMusicId, setPickedMusicId] = useState<string | null>(null);
  const [aspect, setAspect] = useState<"9:16" | "16:9" | "1:1">("9:16");
  const [seconds, setSeconds] = useState(3);
  const [caption, setCaption] = useState("");
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

  const canGenerate = images.length > 0;

  return (
    <div className="screen slideshow-screen vup">
      <div className="real-badge">
        <span className="real-badge-dot" /> Real generation — this actually renders on our server
      </div>

      <p className="disclaimer-note" style={{ margin: "10px 2px 16px" }}>
        Upload your own photos (and optionally your own music) and VIDORA assembles a real Ken
        Burns-style slideshow video — no placeholder, no simulation.
      </p>

      <input
        className="text-input"
        placeholder="Project name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ marginBottom: 16 }}
      />

      <div className="section-label" style={{ marginTop: 0 }}>Photos</div>
      <div className="ref-slots slideshow-image-grid">
        {images.map((file, i) => (
          <div key={i} className="slideshow-thumb">
            <img src={URL.createObjectURL(file)} alt={`Upload ${i + 1}`} />
            <button
              className="slideshow-thumb-remove"
              aria-label={`Remove image ${i + 1}`}
              onClick={() => setImages((imgs) => imgs.filter((_, idx) => idx !== i))}
            >
              <IconClose width={12} height={12} />
            </button>
          </div>
        ))}
        {images.length < 12 && (
          <button className="ref-slot" onClick={() => imgInputRef.current?.click()} aria-label="Add photos">
            <IconPlus width={18} height={18} />
          </button>
        )}
      </div>
      <input
        ref={imgInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          setImages((imgs) => [...imgs, ...files].slice(0, 12));
          e.target.value = "";
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
          <span className="music-picked-name">{music.name}</span>
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
          if (file) {
            setMusic(file);
            setPickedMusicId(null);
          }
          e.target.value = "";
        }}
      />

      <div className="section-label">Aspect ratio</div>
      <div className="style-chip-row">
        {ASPECTS.map((a) => (
          <Chip key={a.id} selected={aspect === a.id} onClick={() => setAspect(a.id)}>
            {a.label}
          </Chip>
        ))}
      </div>

      <div className="section-label">Seconds per photo</div>
      <div className="style-chip-row">
        {[1.5, 2, 3, 4, 5].map((s) => (
          <Chip key={s} selected={seconds === s} onClick={() => setSeconds(s)}>
            {s}s
          </Chip>
        ))}
      </div>

      <div className="section-label">Caption (optional, burned into the video)</div>
      <input
        className="text-input"
        placeholder="e.g. Aurora Skincare"
        value={caption}
        onChange={(e) => setCaption(e.target.value.slice(0, 80))}
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
            music,
            musicAssetId: pickedMusicId ?? undefined,
            aspectRatio: aspect,
            secondsPerImage: seconds,
            caption,
          })
        }
      >
        {canGenerate ? `Generate real video (${images.length} photo${images.length === 1 ? "" : "s"})` : "Add at least one photo"}
      </Button>
    </div>
  );
}
