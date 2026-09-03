import { mkdir } from "node:fs/promises";
import { join } from "node:path";

// Railway volumes mount at a fixed path — configure STORAGE_DIR to that mount
// in production so uploads survive redeploys. Falls back to a local folder
// for development.
export const STORAGE_DIR = process.env.STORAGE_DIR || join(process.cwd(), "data");

export function storagePathFor(userId: string, filename: string): string {
  return join(userId, filename);
}

export function absolutePath(storagePath: string): string {
  return join(STORAGE_DIR, storagePath);
}

export async function ensureUserDir(userId: string): Promise<string> {
  const dir = join(STORAGE_DIR, userId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function ensureStorageRoot(): Promise<void> {
  await mkdir(STORAGE_DIR, { recursive: true });
}
