import { useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import type { AssetCategory, UploadedAsset } from "../lib/api";
import { Button } from "../components/ui";
import { IconPlay, IconClose, IconEdit, IconDelete } from "../components/icons";

type Tab = "MUSIC" | "SFX" | "FAVORITES";

const TAB_LABEL: Record<Tab, string> = {
  MUSIC: "My Music",
  SFX: "My Sounds",
  FAVORITES: "Favorites",
};

function formatDuration(sec: number | null): string {
  if (sec == null) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MusicLibrary() {
  const [tab, setTab] = useState<Tab>("MUSIC");
  const [items, setItems] = useState<UploadedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobCache = useRef<Map<string, string>>(new Map());
  const musicInputRef = useRef<HTMLInputElement>(null);
  const soundInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.ensureAuth();
      const assets = await api.listLibrary({
        kind: "AUDIO",
        ...(tab === "FAVORITES" ? { favorite: true } : { category: tab as AssetCategory }),
        ...(search ? { search } : {}),
      });
      setItems(assets);
    } catch {
      setError("Couldn't load your library. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const togglePlay = async (asset: UploadedAsset) => {
    if (playingId === asset.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    let url = blobCache.current.get(asset.id);
    if (!url) {
      url = await api.fetchAssetBlobUrl(asset.id);
      blobCache.current.set(asset.id, url);
    }
    if (audioRef.current) {
      audioRef.current.src = url;
      await audioRef.current.play();
      setPlayingId(asset.id);
    }
  };

  const doUpload = async (files: File[], category: AssetCategory) => {
    if (files.length === 0) return;
    setError(null);
    try {
      await api.ensureAuth();
      for (const file of files) {
        await api.uploadAsset(file, { category });
      }
      await load();
    } catch {
      setError("Upload failed. Please try again.");
    }
  };

  const doRename = async (id: string) => {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    const asset = await api.renameAsset(id, renameValue.trim());
    setItems((list) => list.map((a) => (a.id === id ? asset : a)));
    setRenamingId(null);
  };

  const doFavorite = async (asset: UploadedAsset) => {
    const updated = await api.setFavorite(asset.id, !asset.favorite);
    setItems((list) =>
      tab === "FAVORITES" && !updated.favorite
        ? list.filter((a) => a.id !== asset.id)
        : list.map((a) => (a.id === asset.id ? updated : a))
    );
  };

  const doDelete = async (asset: UploadedAsset) => {
    if (playingId === asset.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    }
    await api.deleteAsset(asset.id);
    setItems((list) => list.filter((a) => a.id !== asset.id));
  };

  return (
    <div className="screen music-library-screen vup">
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} hidden />

      <div className="real-badge" style={{ marginBottom: 10 }}>
        <span className="real-badge-dot" /> Your uploads, stored on your account
      </div>

      <input
        className="text-input"
        placeholder="Search my music and sounds…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 14 }}
      />

      <div className="mode-switch" role="tablist" aria-label="Library section" style={{ marginBottom: 14 }}>
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`mode-seg ${tab === t ? "mode-seg-active" : ""}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="library-upload-row">
        <Button variant="secondary" full onClick={() => musicInputRef.current?.click()}>
          + Upload Music
        </Button>
        <Button variant="secondary" full onClick={() => soundInputRef.current?.click()}>
          + Upload Sound
        </Button>
      </div>
      <input
        ref={musicInputRef}
        type="file"
        accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/flac"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          doUpload(files, "MUSIC");
        }}
      />
      <input
        ref={soundInputRef}
        type="file"
        accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/flac"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          doUpload(files, "SFX");
        }}
      />

      <p className="disclaimer-note" style={{ margin: "12px 2px 16px" }}>
        Only upload audio you own or have permission to use.
      </p>

      {error && <p className="disclaimer-note" style={{ color: "var(--danger)" }}>{error}</p>}

      {loading ? (
        <p className="disclaimer-note">Loading…</p>
      ) : items.length === 0 ? (
        <p className="disclaimer-note">
          {tab === "FAVORITES" ? "Nothing favorited yet." : "Nothing uploaded yet — add a file above."}
        </p>
      ) : (
        <div className="library-list">
          {items.map((asset) => (
            <div key={asset.id} className="library-row">
              <button
                className="library-play-btn"
                onClick={() => togglePlay(asset)}
                aria-label={playingId === asset.id ? `Pause ${asset.filename}` : `Play ${asset.filename}`}
              >
                {playingId === asset.id ? <IconClose width={13} height={13} /> : <IconPlay width={13} height={13} />}
              </button>
              <div className="library-info">
                {renamingId === asset.id ? (
                  <input
                    className="text-input"
                    style={{ height: 30, fontSize: 12 }}
                    value={renameValue}
                    autoFocus
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => doRename(asset.id)}
                    onKeyDown={(e) => e.key === "Enter" && doRename(asset.id)}
                  />
                ) : (
                  <div className="library-name">{asset.filename}</div>
                )}
                <div className="library-meta mono">
                  {formatDuration(asset.durationSec)} · {formatSize(asset.sizeBytes)}
                </div>
              </div>
              <button
                className={`library-fav-btn ${asset.favorite ? "library-fav-btn-active" : ""}`}
                onClick={() => doFavorite(asset)}
                aria-label={asset.favorite ? "Remove from favorites" : "Add to favorites"}
              >
                ★
              </button>
              <button
                className="library-icon-btn"
                onClick={() => {
                  setRenamingId(asset.id);
                  setRenameValue(asset.filename);
                }}
                aria-label={`Rename ${asset.filename}`}
              >
                <IconEdit width={14} height={14} />
              </button>
              <button
                className="library-icon-btn library-icon-btn-danger"
                onClick={() => doDelete(asset)}
                aria-label={`Delete ${asset.filename}`}
              >
                <IconDelete width={14} height={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
