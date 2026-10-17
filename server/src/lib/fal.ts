// Real fal.ai text-to-video client (https://fal.ai, queue-based REST API,
// confirmed against their published docs — not guessed). Hosts Wan 2.5, an
// open-source-derived model — cheaper per-second than Runway, and fal gives
// new accounts a small one-time free credit, so this is the "free to try"
// path for Prompt → Video. Still a real per-second cost once that credit
// runs out, same as every other provider; never pretend otherwise.
//
// Deliberately does NOT throw at import time when FAL_KEY is missing — like
// Runway, this is an optional capability the server must still boot without.

const BASE_URL = "https://queue.fal.run";
const MODEL_ID = "fal-ai/wan-25-preview/text-to-video";

export function isFalConfigured(): boolean {
  return Boolean(process.env.FAL_KEY);
}

export class FalError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

async function falFetch<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const key = process.env.FAL_KEY;
  if (!key) throw new FalError("fal.ai API key is not configured on this server.", 503);

  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (body as { detail?: string; error?: string })?.detail || (body as any)?.error || `fal.ai request failed (${res.status})`;
    throw new FalError(typeof message === "string" ? message : JSON.stringify(message), res.status);
  }
  return body as T;
}

export type FalAspectRatio = "16:9" | "9:16" | "1:1";
export type FalDuration = 5 | 10;

export interface FalTaskHandle {
  requestId: string;
  statusUrl: string;
  responseUrl: string;
}

export async function createTextToVideoTask(opts: {
  prompt: string;
  aspectRatio: FalAspectRatio;
  duration: FalDuration;
}): Promise<FalTaskHandle> {
  const body = await falFetch<{ request_id: string; status_url: string; response_url: string }>(
    `${BASE_URL}/${MODEL_ID}`,
    {
      method: "POST",
      body: JSON.stringify({
        prompt: opts.prompt,
        aspect_ratio: opts.aspectRatio,
        duration: String(opts.duration),
        resolution: "480p", // cheapest tier ($0.05/real-second) — matches this app's credit rate 1:1
      }),
    }
  );
  return { requestId: body.request_id, statusUrl: body.status_url, responseUrl: body.response_url };
}

export type FalStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";

export interface FalStatusResponse {
  status: FalStatus;
  queue_position?: number;
  error?: string;
}

export async function getTaskStatus(statusUrl: string): Promise<FalStatusResponse> {
  return falFetch<FalStatusResponse>(statusUrl, { method: "GET" });
}

export interface FalResult {
  video: { url: string; content_type?: string; width?: number; height?: number; duration?: number };
  seed?: number;
}

export async function getTaskResult(responseUrl: string): Promise<FalResult> {
  return falFetch<FalResult>(responseUrl, { method: "GET" });
}
