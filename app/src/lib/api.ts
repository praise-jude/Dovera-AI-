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

export interface Project {
  id: string;
  name: string;
  status: string;
}

export async function createProject(name: string): Promise<Project> {
  const { project } = await request<{ project: Project }>("/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
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

export interface SlideshowJobParams {
  imageAssetIds: string[];
  musicAssetId?: string;
  secondsPerImage?: number;
  aspectRatio?: "9:16" | "16:9" | "1:1";
  captions?: { text: string; atSec: number; durationSec: number }[];
}

export interface JobRecord {
  id: string;
  status: "QUEUED" | "ANALYZING" | "GENERATING" | "PROCESSING" | "ADDING_AUDIO" | "RENDERING" | "EXPORTING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progress: number;
  statusMessage: string | null;
  error: string | null;
  resultAssetId: string | null;
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

export async function fetchAssetBlobUrl(assetId: string): Promise<string> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/assets/${assetId}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError("Couldn't load the generated video.", res.status);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
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
