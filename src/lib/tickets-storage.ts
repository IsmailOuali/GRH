import path from "path";

/** Server-only: where the files attached to tickets live on disk. */

export function ticketFilesDir(): string {
  return path.join(process.cwd(), "uploads", "tickets");
}

/** Absolute path of a stored file. `basename` guards against a tampered DB value. */
export function ticketFilePath(filename: string): string {
  return path.join(ticketFilesDir(), path.basename(filename));
}
