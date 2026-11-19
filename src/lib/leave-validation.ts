/**
 * Input rules for a leave request, shared by the form (instant feedback) and
 * the server action (the real enforcement). Pure and client-safe.
 *
 * They exist because a date input accepts years up to 275760: without bounds a
 * single typo would make the day-counting loops run for millions of
 * iterations, in the browser and on the server.
 */

export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;
export const MIN_DATE = `${MIN_YEAR}-01-01`;
export const MAX_DATE = `${MAX_YEAR}-12-31`;

/** Longest period a single request may cover, in calendar days. */
export const MAX_LEAVE_SPAN_DAYS = 366;

/** How far from the leave period the family event may be, in days. */
export const MAX_EVENT_GAP_DAYS = 30;

export const MAX_COMMENT_LENGTH = 500;

const DAY_MS = 86_400_000;

function yearOk(d: Date): boolean {
  const y = d.getFullYear();
  return y >= MIN_YEAR && y <= MAX_YEAR;
}

/** Error message for an unusable period, or null when it is fine. */
export function validateLeaveDates(start: Date, end: Date): string | null {
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "Dates invalides.";
  if (!yearOk(start) || !yearOk(end))
    return `Les dates doivent être comprises entre ${MIN_YEAR} et ${MAX_YEAR}.`;
  if (end < start) return "La date de fin doit être après la date de début.";
  const span = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  if (span > MAX_LEAVE_SPAN_DAYS)
    return `La période ne peut pas dépasser ${MAX_LEAVE_SPAN_DAYS} jours.`;
  return null;
}

/**
 * Error message for the family-event date of a congé spécial. It must sit
 * close to the leave period: otherwise anyone could invent a different "event
 * date" per request and start over with a fresh droit each time.
 */
export function validateEventDate(event: Date, start: Date, end: Date): string | null {
  if (isNaN(event.getTime()))
    return "La date de l'événement est obligatoire pour un congé spécial.";
  if (!yearOk(event)) return `La date de l'événement doit être comprise entre ${MIN_YEAR} et ${MAX_YEAR}.`;
  const gap = MAX_EVENT_GAP_DAYS * DAY_MS;
  if (event.getTime() < start.getTime() - gap || event.getTime() > end.getTime() + gap)
    return `La date de l'événement doit se situer à moins de ${MAX_EVENT_GAP_DAYS} jours de la période demandée.`;
  return null;
}
