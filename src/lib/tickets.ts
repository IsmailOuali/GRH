/**
 * Tickets RH — a salarié reports an error or asks a question; the RH answers.
 * Pure and client-safe: read by the form, the server actions and the page.
 */

export type TicketCategory = { value: string; label: string };

export const TICKET_CATEGORIES: TicketCategory[] = [
  { value: "ERREUR_BULLETIN", label: "Erreur sur mon bulletin de paie" },
  { value: "ERREUR_CONGES", label: "Erreur sur mes congés ou mon solde" },
  { value: "ERREUR_INFOS", label: "Erreur dans mes informations personnelles" },
  { value: "AUTRE", label: "Autre" },
];

export const TICKET_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  TICKET_CATEGORIES.map((c) => [c.value, c.label]),
);

export function isValidTicketCategory(value: string): boolean {
  return value in TICKET_CATEGORY_LABELS;
}

/** OPEN: waiting for the RH · IN_PROGRESS: taken, answer pending · RESOLVED: closed. */
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

/** Statuses of a ticket the RH still has to deal with. */
export const ACTIVE_TICKET_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS"];

export const MAX_SUBJECT_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_RESPONSE_LENGTH = 2000;

/** A salarié can have at most this many unresolved tickets at once. */
export const MAX_ACTIVE_TICKETS_PER_USER = 5;

// ── Pièces jointes (captures d'écran, images, PDF) ───────────────────────────
export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8 MB each

/** Allowed types: screenshots/photos, plus PDF (e.g. the bulletin in question). */
export const ATTACHMENT_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

export function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}
