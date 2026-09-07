import { useCallback, useRef } from "react";

interface WaveformProps {
  peaks: number[];
  durationSec: number;
  trimStartSec?: number;
  usedSec?: number; // how much of the track will actually play, from trimStartSec
  onChangeTrimStart?: (sec: number) => void;
  // Preview-only mode (e.g. Music Library): just renders the bars, no
  // trim handle/selection band, no pointer interaction.
  interactive?: boolean;
}

// Tap or drag anywhere on the bars to move the trim-start point. The
// highlighted band shows exactly the window of the track [trimStart,
// trimStart + usedSec) that will actually play in the render.
export function Waveform({
  peaks,
  durationSec,
  trimStartSec = 0,
  usedSec = 0,
  onChangeTrimStart,
  interactive = true,
}: WaveformProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const maxStart = Math.max(0, durationSec - usedSec);

  const setFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || durationSec <= 0 || !onChangeTrimStart) return;
      const rect = el.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const sec = Math.min(maxStart, Math.max(0, frac * durationSec));
      onChangeTrimStart(sec);
    },
    [durationSec, maxStart, onChangeTrimStart]
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || e.buttons !== 1) return;
    setFromClientX(e.clientX);
  };

  const startPct = durationSec > 0 ? (trimStartSec / durationSec) * 100 : 0;
  const widthPct = durationSec > 0 ? (Math.min(usedSec, durationSec - trimStartSec) / durationSec) * 100 : 0;

  return (
    <div
      ref={trackRef}
      className="waveform-track"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      role={interactive ? "slider" : undefined}
      aria-label={interactive ? "Music start point" : undefined}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? maxStart : undefined}
      aria-valuenow={interactive ? trimStartSec : undefined}
      style={interactive ? undefined : { cursor: "default" }}
    >
      <div className="waveform-bars">
        {peaks.map((p, i) => (
          <div key={i} className="waveform-bar" style={{ height: `${Math.max(6, p * 100)}%` }} />
        ))}
      </div>
      {interactive && (
        <>
          <div className="waveform-selection" style={{ left: `${startPct}%`, width: `${widthPct}%` }} />
          <div className="waveform-handle" style={{ left: `${startPct}%` }} />
        </>
      )}
    </div>
  );
}
