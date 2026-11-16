/**
 * Légalisation of an attestation — the stamped copy issued by the commune.
 *
 * It is a physical step a manager performs, so the app only tracks it. A
 * request that asked for it is "en cours" from approval until the manager
 * closes it, either by importing the scan or by noting a hand-over.
 *
 * Pure and client-safe. Disk locations live in legalisation-storage.ts.
 */

export type LegalisationState =
  | "NONE" // not requested, or the request is not approved yet
  | "EN_COURS" // approved, légalisée copy not delivered yet
  | "SCAN" // closed: scanned copy available on the platform
  | "MAIN_PROPRE"; // closed: handed over in person

export const LEGALISATION_MAX_BYTES = 15 * 1024 * 1024; // 15 MB

export type LegalisationFields = {
  status: string;
  legalise: boolean;
  legaliseAt: Date | null;
  legaliseDelivery: string | null;
};

export function legalisationState(r: LegalisationFields): LegalisationState {
  if (!r.legalise || r.status !== "APPROVED") return "NONE";
  if (!r.legaliseAt) return "EN_COURS";
  return r.legaliseDelivery === "SCAN" ? "SCAN" : "MAIN_PROPRE";
}
