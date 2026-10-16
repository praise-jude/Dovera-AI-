import { del, get as blobGet, put } from "@vercel/blob";

// Real persistent object storage (Vercel Blob, private access — every read
// requires the server's own credentials, same as the old per-user-folder
// disk layout did via requireAuth + ownership checks). Local disk doesn't
// survive between invocations on Vercel, so this replaced the old
// Railway-volume-backed filesystem storage entirely.

export function storagePathFor(userId: string, filename: string): string {
  return `${userId}/${filename}`;
}

export async function saveFile(storagePath: string, data: Buffer, contentType: string): Promise<{ size: number }> {
  await put(storagePath, data, {
    access: "private",
    contentType,
    addRandomSuffix: false,
  });
  return { size: data.length };
}

export interface BlobReadResult {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  status: number; // 200 or 206
  contentLength: string | null;
  contentRange: string | null;
}

// Passes a Range header straight through to blob storage so <video>/<audio>
// seeking keeps working exactly like it did against the old disk-backed
// route — this was a hard-won fix (see git history) and must not regress.
export async function readFile(storagePath: string, rangeHeader?: string): Promise<BlobReadResult | null> {
  const result = await blobGet(storagePath, {
    access: "private",
    headers: rangeHeader ? { range: rangeHeader } : undefined,
  });
  if (!result || !result.stream) return null;
  const contentRange = result.headers.get("content-range");
  return {
    stream: result.stream,
    contentType: result.blob.contentType || "application/octet-stream",
    status: contentRange ? 206 : 200,
    contentLength: result.headers.get("content-length"),
    contentRange,
  };
}

export async function deleteFile(storagePath: string): Promise<void> {
  await del(storagePath).catch(() => {});
}

// FFmpeg needs real file paths for its multi-input filter graphs, so the
// render workers pull inputs down to a local temp dir and push results back
// up — only that temp directory is ever written to local disk, and it's
// discarded at the end of each job regardless of outcome.
export async function downloadToLocalFile(storagePath: string, destPath: string): Promise<void> {
  const result = await blobGet(storagePath, { access: "private" });
  if (!result?.stream) throw new Error(`Blob not found: ${storagePath}`);
  const { writeFile } = await import("node:fs/promises");
  const chunks: Uint8Array[] = [];
  const reader = result.stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  await writeFile(destPath, Buffer.concat(chunks));
}

export async function uploadLocalFile(
  storagePath: string,
  localPath: string,
  contentType: string
): Promise<{ size: number }> {
  const { readFile: fsReadFile } = await import("node:fs/promises");
  const data = await fsReadFile(localPath);
  return saveFile(storagePath, data, contentType);
}
