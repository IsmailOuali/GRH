/**
 * Télétravail helpers shared by the assignment form (client) and the server
 * action that persists the days. Dates are `yyyy-mm-dd` strings throughout —
 * same representation as the RemoteWorkDay.date column.
 */

import { parseLocalDate, toIso } from "@/lib/dates";

/** Monday–Friday, in the order the form shows them. `value` is `Date#getDay()`. */
export const WEEKDAYS = [
  { value: 1, short: "Lun", label: "Lundi" },
  { value: 2, short: "Mar", label: "Mardi" },
  { value: 3, short: "Mer", label: "Mercredi" },
  { value: 4, short: "Jeu", label: "Jeudi" },
  { value: 5, short: "Ven", label: "Vendredi" },
] as const;

/** Guard rail on the recurring pattern: no assignment may span over a year. */
export const MAX_SPAN_DAYS = 366;

/**
 * Every business day between `startIso` and `endIso` (both inclusive) whose
 * weekday is in `weekdays`. An empty `weekdays` means "all business days".
 * Weekends are never produced, even if 0/6 are passed in.
 *
 * Returns [] when the range is invalid, reversed, or longer than
 * {@link MAX_SPAN_DAYS} — the caller reports the reason, this stays pure.
 */
export function expandRemoteDays(
  startIso: string,
  endIso: string,
  weekdays: number[] = [],
): string[] {
  const start = parseLocalDate(startIso);
  const end = parseLocalDate(endIso);
  if (!start || !end || end < start) return [];

  const span = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (span > MAX_SPAN_DAYS) return [];

  const wanted = weekdays.filter((d) => d >= 1 && d <= 5);
  const days: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    const isBusinessDay = dow !== 0 && dow !== 6;
    if (isBusinessDay && (wanted.length === 0 || wanted.includes(dow))) {
      days.push(toIso(cur));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/** `yyyy-mm-dd` of the first day of the month `monthsFromNow` away from today. */
export function monthStartIso(monthsFromNow = 0): string {
  const d = new Date();
  return toIso(new Date(d.getFullYear(), d.getMonth() + monthsFromNow, 1));
}
