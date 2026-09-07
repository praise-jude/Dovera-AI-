// Real Runway ML text-to-video API client (https://docs.dev.runwayml.com).
// Deliberately does NOT throw at import time if RUNWAY_API_KEY is missing —
// unlike Paystack (which the server can't run without), this is an optional
// paid capability the user may not have funded yet. Callers must check
// isRunwayConfigured() and fail gracefully (503 "not configured"), never
// pretend to generate something when the key is absent.

const BASE_URL = "https://api.dev.runwayml.com";
const API_VERSION = "2024-11-06";

export function isRunwayConfigured(): boolean {
  return Boolean(process.env.RUNWAY_API_KEY);
}

class RunwayError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

async function runwayFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const key = process.env.RUNWAY_API_KEY;
  if (!key) throw new RunwayError("Runway API key is not configured on this server.", 503);

  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Runway-Version": API_VERSION,
      ...opts.headers,
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (body as { error?: string })?.error || `Runway request failed (${res.status})`;
    throw new RunwayError(message, res.status);
  }
  return body as T;
}

export type RunwayDuration = 4 | 6 | 8;
export type RunwayRatio = "1280:720" | "720:1280" | "960:960";

export interface RunwayTaskCreated {
  id: string;
}

export async function createTextToVideoTask(opts: {
  promptText: string;
  ratio: RunwayRatio;
  duration: RunwayDuration;
}): Promise<RunwayTaskCreated> {
  return runwayFetch<RunwayTaskCreated>("/v1/text_to_video", {
    method: "POST",
    body: JSON.stringify({
      model: "gen4_turbo",
      promptText: opts.promptText,
      ratio: opts.ratio,
      duration: opts.duration,
    }),
  });
}

export type RunwayTaskStatus = "PENDING" | "THROTTLED" | "RUNNING" | "SUCCEEDED" | "FAILED";

export interface RunwayTask {
  id: string;
  status: RunwayTaskStatus;
  progress?: number;
  output?: string[];
  failure?: string;
  failureCode?: string;
}

export async function getTask(id: string): Promise<RunwayTask> {
  return runwayFetch<RunwayTask>(`/v1/tasks/${id}`, { method: "GET" });
}

export { RunwayError };
