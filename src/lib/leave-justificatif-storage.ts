import path from "path";

/** Server-only: where the justificatifs d'absence live on disk. */

export function justificatifDir(): string {
  return path.join(process.cwd(), "uploads", "justificatifs");
}

/** Absolute path of a stored file. `basename` guards against a tampered DB value. */
export function justificatifFilePath(filename: string): string {
  return path.join(justificatifDir(), path.basename(filename));
}
