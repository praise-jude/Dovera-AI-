// Real waveform data — decodes actual audio samples via the Web Audio API
// (same approach as beatDetect.ts) and reduces them to per-bucket peak
// amplitudes for rendering. Not a synthetic/fake shape: silence renders as
// a flat line, loud sections render tall, exactly like the source audio.

export interface WaveformData {
  peaks: number[]; // 0..1, one per bucket
  durationSec: number;
}

async function decodeArrayBuffer(buffer: ArrayBuffer): Promise<AudioBuffer | null> {
  const AudioCtxCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxCtor) return null;
  const ctx = new AudioCtxCtor();
  try {
    return await ctx.decodeAudioData(buffer);
  } catch {
    return null;
  } finally {
    void ctx.close();
  }
}

function computePeaks(audioBuffer: AudioBuffer, buckets: number): WaveformData {
  const data = audioBuffer.numberOfChannels > 0 ? audioBuffer.getChannelData(0) : new Float32Array(0);
  const bucketSize = Math.max(1, Math.floor(data.length / buckets));
  const peaks: number[] = [];
  for (let i = 0; i < buckets; i++) {
    const start = i * bucketSize;
    const end = Math.min(data.length, start + bucketSize);
    let max = 0;
    for (let j = start; j < end; j++) {
      const v = Math.abs(data[j]);
      if (v > max) max = v;
    }
    peaks.push(max);
  }
  return { peaks, durationSec: audioBuffer.duration };
}

export async function decodeWaveformFromFile(file: File, buckets = 90): Promise<WaveformData | null> {
  try {
    const buffer = await file.arrayBuffer();
    const audioBuffer = await decodeArrayBuffer(buffer);
    if (!audioBuffer) return null;
    return computePeaks(audioBuffer, buckets);
  } catch {
    return null;
  }
}

export async function decodeWaveformFromUrl(url: string, buckets = 90): Promise<WaveformData | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const audioBuffer = await decodeArrayBuffer(buffer);
    if (!audioBuffer) return null;
    return computePeaks(audioBuffer, buckets);
  } catch {
    return null;
  }
}
