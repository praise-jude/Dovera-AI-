import ffprobePath from "@ffprobe-installer/ffprobe";
import ffmpeg from "fluent-ffmpeg";
import { chmod } from "node:fs/promises";

ffmpeg.setFfprobePath(ffprobePath.path);
// Same rationale as the ffmpeg binary: the postinstall chmod is gated by a
// version-pinned script allowlist that can't be pre-approved for a platform
// package this dev machine never installs (linux-x64, when developing on
// Windows). Set the exec bit ourselves so a missed approval fails loudly at
// build time instead of silently at first use in production.
void chmod(ffprobePath.path, 0o755).catch(() => {});

export function probeDurationSeconds(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err || !data?.format?.duration) {
        resolve(null);
        return;
      }
      resolve(data.format.duration);
    });
  });
}
