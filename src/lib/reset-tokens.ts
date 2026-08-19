import { randomBytes, createHash } from "crypto";

/** How long a password-reset link stays valid. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/** SHA-256 of the raw token — only the hash is ever stored in the DB. */
export function hashResetToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** A fresh random token: the raw value goes in the email link, the hash in the DB. */
export function generateResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashResetToken(raw) };
}
