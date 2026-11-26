/**
 * Justificatif d'absence: shared constants and the "what state is this request
 * in" rule. Pure and client-safe (disk paths live in leave-justificatif-storage.ts).
 */

import { isSpecialLeave, needsJustificatif } from "@/lib/leave-types";

export const JUSTIFICATIF_MAX_BYTES = 15 * 1024 * 1024; // 15 MB

export type JustificatifState =
  /** This type of request has no justificatif. */
  | "NONE"
  /** Expected but not filed yet — the employee can still add it. */
  | "MISSING"
  /** Filed. */
  | "PROVIDED";

type JustificatifLike = {
  type: string;
  status: string;
  justificatifFile: string | null;
};

export function justificatifState(r: JustificatifLike): JustificatifState {
  if (r.justificatifFile) return "PROVIDED";
  // A refused request no longer waits for a proof.
  if (needsJustificatif(r.type) && r.status !== "REJECTED") return "MISSING";
  return "NONE";
}

/**
 * This type of request may carry a justificatif: the absences that expect one
 * (maladie, absence justifiée) and the congés spéciaux (acte de mariage, de
 * décès…). On a congé spécial it is optional and never reported as "attendu".
 */
export function allowsJustificatif(type: string): boolean {
  return needsJustificatif(type) || isSpecialLeave(type);
}

/** The employee may file (or replace) a justificatif on this request. */
export function canFileJustificatif(r: JustificatifLike): boolean {
  return allowsJustificatif(r.type) && r.status !== "REJECTED";
}
