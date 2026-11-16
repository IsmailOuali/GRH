import path from "path";

/** Server-only: where the scanned légalisée copies live on disk. */

/** Folder holding the scanned légalisée copies. */
export function legalisationDir(): string {
  return path.join(process.cwd(), "uploads", "legalisations");
}

/** Absolute path of a stored scan. `basename` guards against a tampered DB value. */
export function legalisationFilePath(filename: string): string {
  return path.join(legalisationDir(), path.basename(filename));
}
