/**
 * Small, dependency-free date helpers shared by client and server code.
 *
 * THE WORKING WEEK IS DEFINED ONCE, HERE. FAIR2UP works Monday–Friday; Saturday
 * and Sunday are both chômés, and public holidays are not modelled. Congé
 * day-counts, the date de reprise, télétravail expansion and the absenteeism
 * denominator all read this same rule — they used to carry private copies of
 * it, which drifted (the suivi module counted Saturday as worked while the
 * congé form did not, so the same month was 26 jours ouvrés on one tab and 21
 * on another). Change the week here and everything follows.
 */

/** Parse a `yyyy-mm-dd` string as a LOCAL date (avoids UTC off-by-one). */
export function parseLocalDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Format a Date as `yyyy-mm-dd` (local). */
export function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** True for Monday–Friday. The single source of truth for "jour ouvré". */
export function isBusinessDay(d: Date): boolean {
  const wd = d.getDay();
  return wd !== 0 && wd !== 6;
}

/** Next weekday strictly after `d` — the "date de reprise". */
export function nextBusinessDay(d: Date): Date {
  const r = new Date(d);
  do {
    r.setDate(r.getDate() + 1);
  } while (!isBusinessDay(r));
  return r;
}

/** Jours ouvrés between two dates, both ends inclusive. */
export function businessDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (isBusinessDay(cur)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/** Jours ouvrés in a calendar month. `month` is 1-based. */
export function businessDaysInMonth(year: number, month: number): number {
  const days = new Date(year, month, 0).getDate();
  let n = 0;
  for (let d = 1; d <= days; d++) {
    if (isBusinessDay(new Date(year, month - 1, d))) n++;
  }
  return n;
}

/** Same as {@link nextBusinessDay} but string in / string out (`yyyy-mm-dd`). */
export function nextBusinessDayIso(iso: string): string {
  const d = parseLocalDate(iso);
  return d ? toIso(nextBusinessDay(d)) : "";
}

/** `yyyy-mm-dd` → `dd/mm/yyyy` (returns the input unchanged if it doesn't match). */
export function formatFrIso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
