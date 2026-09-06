// Real, self-contained beat detection — runs entirely client-side via the
// Web Audio API, no server call and no external service. It's a classic
// energy-based onset detector (compare each short window's energy against a
// rolling local average), not a machine-learning model: it works well on
// tracks with a clear percussive pulse and can legitimately fail to find
// anything on ambient/melodic audio. Callers must treat a null result as
// "no confident beat found" and fall back to even timing — never fabricate
// a BPM when the signal doesn't support one.

export interface BeatInfo {
  bpm: number;
  offsetSec: number;
  beatCount: number;
}

export async function detectBeats(file: File): Promise<BeatInfo | null> {
  const AudioCtxCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxCtor) return null;

  let ctx: AudioContext | null = null;
  try {
    const arrayBuffer = await file.arrayBuffer();
    ctx = new AudioCtxCtor();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    const data = mixToMono(audioBuffer);
    const beatTimes = findEnergyPeaks(data, audioBuffer.sampleRate);
    if (beatTimes.length < 6) return null;

    const bpm = estimateBpm(beatTimes);
    if (!bpm) return null;

    return { bpm, offsetSec: beatTimes[0], beatCount: beatTimes.length };
  } catch {
    return null;
  } finally {
    void ctx?.close();
  }
}

function mixToMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  const out = new Float32Array(buffer.length);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < buffer.length; i++) out[i] += data[i] / buffer.numberOfChannels;
  }
  return out;
}

function findEnergyPeaks(data: Float32Array, sampleRate: number): number[] {
  const windowSize = 1024;
  const windowsPerSec = sampleRate / windowSize;
  const historyWindows = Math.max(4, Math.round(windowsPerSec)); // ~1s of local history

  const energies: number[] = [];
  for (let i = 0; i + windowSize <= data.length; i += windowSize) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) sum += data[i + j] * data[i + j];
    energies.push(sum / windowSize);
  }

  const beats: number[] = [];
  const minGapWindows = Math.max(1, Math.round(windowsPerSec * 0.25)); // >=250ms apart
  let lastBeatIndex = -minGapWindows;

  for (let i = historyWindows; i < energies.length; i++) {
    let sum = 0;
    let sumSq = 0;
    for (let k = i - historyWindows; k < i; k++) {
      sum += energies[k];
      sumSq += energies[k] * energies[k];
    }
    const avg = sum / historyWindows;
    const variance = sumSq / historyWindows - avg * avg;
    if (avg <= 1e-9) continue;
    // A steadier signal (low variance) needs a lower threshold to catch its
    // beats; a dynamic one needs a higher bar so noise isn't mistaken for a
    // beat. Constants are the commonly-cited values for this technique.
    const threshold = -0.0000015 * variance + 1.5142857;
    if (energies[i] > threshold * avg && i - lastBeatIndex >= minGapWindows) {
      beats.push((i * windowSize) / sampleRate);
      lastBeatIndex = i;
    }
  }
  return beats;
}

function estimateBpm(beatTimes: number[]): number | null {
  const intervals: number[] = [];
  for (let i = 1; i < beatTimes.length; i++) intervals.push(beatTimes[i] - beatTimes[i - 1]);

  // Fold octave-related intervals (half/double tempo) into a common 70-180
  // BPM range so "beat every other beat" doesn't register as a separate
  // tempo from the true one.
  const rounded = intervals
    .filter((s) => s > 0.05)
    .map((s) => 60 / s)
    .map((bpm) => {
      let b = bpm;
      while (b < 70) b *= 2;
      while (b > 180) b /= 2;
      return Math.round(b);
    });

  const counts = new Map<number, number>();
  for (const b of rounded) counts.set(b, (counts.get(b) ?? 0) + 1);

  let best: number | null = null;
  let bestCount = 0;
  for (const [b, c] of counts) {
    if (c > bestCount) {
      best = b;
      bestCount = c;
    }
  }
  // Require the winning tempo to explain a real fraction of the intervals —
  // otherwise this is noise, not a beat.
  if (best == null || bestCount < Math.max(3, rounded.length * 0.25)) return null;
  return best;
}

/**
 * Distributes `count` clip durations that each land on a whole number of
 * beats, summing to as close to `targetTotalSec` as the beat grid allows.
 * The final clip absorbs any small rounding remainder.
 */
export function beatAlignedDurations(
  count: number,
  beat: BeatInfo,
  targetTotalSec: number,
  minSec = 1,
  maxSec = 12
): number[] {
  const beatInterval = 60 / beat.bpm;
  const idealPerClip = targetTotalSec / count;
  const beatsPerClip = Math.max(1, Math.round(idealPerClip / beatInterval));
  const clipDur = Math.max(minSec, Math.min(maxSec, beatsPerClip * beatInterval));

  const durations = new Array(count).fill(clipDur);
  const drift = targetTotalSec - clipDur * count;
  durations[count - 1] = Math.max(minSec, Math.min(maxSec, durations[count - 1] + drift));
  return durations;
}
