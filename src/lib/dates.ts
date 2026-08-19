/**
 * Small, dependency-free date helpers shared by client and server code.
 * "Business day" here means Monday–Friday (weekends only; no public holidays).
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

/** Next weekday strictly after `d` (skips Sat/Sun) — the "date de reprise". */
export function nextBusinessDay(d: Date): Date {
  const r = new Date(d);
  do {
    r.setDate(r.getDate() + 1);
  } while (r.getDay() === 0 || r.getDay() === 6);
  return r;
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
