const API_BASE = import.meta.env.VITE_API_BASE || "https://vidora-api-production-165d.up.railway.app";

const TOKEN_KEY = "vidora_token";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // localStorage unavailable (private browsing, etc.) — session-only auth
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(opts.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.error || "Something went wrong. Please try again.", res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// A device-scoped account is created transparently on first use so the real
// backend flows work without a login screen (none exists in this design).
// The token persists in localStorage; each browser/device gets its own
// account and its own projects.
let authPromise: Promise<void> | null = null;

// Called after login()/logout() so the next ensureAuth() re-checks against
// whatever token now actually lives in localStorage, instead of reusing a
// stale resolved promise from a previous account.
function resetAuthCache(): void {
  authPromise = null;
}

export function ensureAuth(): Promise<void> {
  if (authPromise) return authPromise;
  authPromise = (async () => {
    const existing = getToken();
    if (existing) {
      try {
        await request("/auth/me");
        return;
      } catch {
        // token invalid/expired — fall through to create a new account
      }
    }
    const email = `device-${crypto.randomUUID()}@vidora.local`;
    const password = crypto.randomUUID();
    const { token } = await request<{ token: string }>("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setToken(token);
  })();
  return authPromise;
}

export interface JobSummary {
  id: string;
  status: "QUEUED" | "ANALYZING" | "GENERATING" | "PROCESSING" | "ADDING_AUDIO" | "RENDERING" | "EXPORTING" | "COMPLETED" | "FAILED" | "CANCELLED";
  resultAssetId: string | null;
  thumbnailAssetId: string | null;
  params: SlideshowJobParams;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  latestJob: JobSummary | null;
  _count: { assets: number; jobs: number };
}

export async function createProject(name: string): Promise<Project> {
  const { project } = await request<{ project: Project }>("/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return project;
}

export async function listProjects(): Promise<Project[]> {
  const { projects } = await request<{ projects: Project[] }>("/projects");
  return projects;
}

export async function deleteProject(id: string): Promise<void> {
  await request<void>(`/projects/${id}`, { method: "DELETE" });
}

export async function renameProject(id: string, name: string): Promise<Project> {
  const { project } = await request<{ project: Project }>(`/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return project;
}

export interface ProjectDetail extends Omit<Project, "latestJob" | "_count"> {
  jobs: JobSummary[];
}

export async function getProject(id: string): Promise<ProjectDetail> {
  const { project } = await request<{ project: ProjectDetail }>(`/projects/${id}`);
  return project;
}

export type AssetCategory = "MUSIC" | "SFX" | "VOICE" | "AMBIENCE" | "OTHER";

export interface UploadedAsset {
  id: string;
  kind: "IMAGE" | "AUDIO" | "VIDEO";
  category: AssetCategory;
  favorite: boolean;
  filename: string;
  durationSec: number | null;
  sizeBytes: number;
  createdAt: string;
}

export async function uploadAsset(
  file: File,
  opts: { projectId?: string; category?: AssetCategory } = {}
): Promise<UploadedAsset> {
  const form = new FormData();
  if (opts.projectId) form.append("projectId", opts.projectId);
  if (opts.category) form.append("category", opts.category);
  form.append("file", file);
  const { asset } = await request<{ asset: UploadedAsset }>("/assets", {
    method: "POST",
    body: form,
  });
  return asset;
}

export async function listLibrary(filter: {
  kind?: "AUDIO" | "IMAGE" | "VIDEO";
  category?: AssetCategory;
  favorite?: boolean;
  search?: string;
} = {}): Promise<UploadedAsset[]> {
  const params = new URLSearchParams();
  if (filter.kind) params.set("kind", filter.kind);
  if (filter.category) params.set("category", filter.category);
  if (filter.favorite) params.set("favorite", "true");
  if (filter.search) params.set("search", filter.search);
  const qs = params.toString();
  const { assets } = await request<{ assets: UploadedAsset[] }>(`/assets${qs ? `?${qs}` : ""}`);
  return assets;
}

export async function renameAsset(id: string, filename: string): Promise<UploadedAsset> {
  const { asset } = await request<{ asset: UploadedAsset }>(`/assets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename }),
  });
  return asset;
}

export async function setFavorite(id: string, favorite: boolean): Promise<UploadedAsset> {
  const { asset } = await request<{ asset: UploadedAsset }>(`/assets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ favorite }),
  });
  return asset;
}

export async function deleteAsset(id: string): Promise<void> {
  await request<void>(`/assets/${id}`, { method: "DELETE" });
}

export type SlideshowStyle = "kenburns" | "cinematic" | "vibrant" | "classic";

export interface SlideshowJobParams {
  imageAssetIds: string[];
  musicAssetId?: string;
  musicVolume?: number;
  soundEffects?: { assetId: string; atSec: number; volume?: number }[];
  secondsPerImage?: number;
  durations?: number[];
  aspectRatio?: "9:16" | "16:9" | "1:1";
  style?: SlideshowStyle;
  captions?: { text: string; atSec: number; durationSec: number }[];
}

export interface JobRecord {
  id: string;
  status: "QUEUED" | "ANALYZING" | "GENERATING" | "PROCESSING" | "ADDING_AUDIO" | "RENDERING" | "EXPORTING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progress: number;
  statusMessage: string | null;
  error: string | null;
  resultAssetId: string | null;
  thumbnailAssetId: string | null;
  creditsEstimated: number;
  creditsCharged: number;
}

export async function createSlideshowJob(projectId: string, params: SlideshowJobParams): Promise<{ job: JobRecord; creditsEstimated: number }> {
  return request("/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, type: "SLIDESHOW_VIDEO", params }),
  });
}

export async function getJob(jobId: string): Promise<JobRecord> {
  const { job } = await request<{ job: JobRecord }>(`/jobs/${jobId}`);
  return job;
}

// A direct, streamable URL for a <video>/<audio>/<img> element to point at.
// Deliberately NOT a fetch-then-blob: a blob forces the whole file into
// memory before anything can play and defeats HTTP range requests, which
// most mobile video players (always iOS Safari, often Android WebView)
// require in order to play at all — this stays a normal progressive stream.
// The token has to travel as a query param since media elements can't send
// an Authorization header; the server only accepts it on this GET route.
export function getAssetFileUrl(assetId: string): string {
  const token = getToken();
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${API_BASE}/assets/${assetId}/file${qs}`;
}

export interface ProviderInfo {
  capability: string;
  name: string;
  configured: boolean;
  kind: string;
  description: string;
}

export async function listProviders(): Promise<ProviderInfo[]> {
  const { providers } = await request<{ providers: ProviderInfo[] }>("/providers");
  return providers;
}

export async function getMe(): Promise<{ credits: number }> {
  return request("/auth/me");
}

export interface BillingStatus {
  plan: "FREE" | "PREMIUM";
  subscriptionStatus: "NONE" | "ACTIVE" | "PAST_DUE" | "CANCELLED";
  planRenewsAt: string | null;
  amountKobo: number;
  currency: string;
}

export async function getBillingStatus(): Promise<BillingStatus> {
  return request("/billing/status");
}

export async function subscribe(): Promise<{ authorizationUrl: string; reference: string }> {
  return request("/billing/subscribe", { method: "POST" });
}

export async function verifyPayment(reference: string): Promise<{ status: string }> {
  return request(`/billing/verify/${encodeURIComponent(reference)}`);
}

export async function cancelSubscription(): Promise<void> {
  await request("/billing/cancel", { method: "POST" });
}

export interface Account {
  id: string;
  email: string;
  name: string | null;
  plan: "FREE" | "PREMIUM";
  credits: number;
  isDeviceAccount: boolean;
}

export async function getAccount(): Promise<Account> {
  return request("/auth/me");
}

// Turns this device's auto-created account into one with a real email and
// password the user chose — the same account, now reachable by logging in
// on another device instead of only ever having an implicit local one.
export async function setCredentials(email: string, password: string): Promise<Account> {
  return request("/auth/credentials", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string): Promise<void> {
  const { token } = await request<{ token: string }>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  setToken(token);
  resetAuthCache();
}

// Drops the stored session. The next ensureAuth() call creates a brand new
// implicit device account — any projects tied to the old account become
// unreachable from this browser unless its credentials were saved first.
export function logout(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
  resetAuthCache();
}
