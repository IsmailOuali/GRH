/**
 * Aïd al-Fitr and Aïd al-Adha: two days each, never deducted from leave.
 *
 * The exact date is only known when it is announced, so each Aïd is first
 * ESTIMATED from the Umm al-Qura calendar (built into Intl), then CONFIRMED by
 * the RH. A confirmation replaces the estimate everywhere (see aid-server.ts).
 *
 * Pure: no database access here.
 */

import type { Holiday } from "@/lib/holidays";

export type Feast = "FITR" | "ADHA";

export const FEAST_LABELS: Record<Feast, string> = {
  FITR: "Aïd al-Fitr",
  ADHA: "Aïd al-Adha",
};

/** How far from the estimate a confirmed first day may be. */
export const MAX_AID_SHIFT_DAYS = 3;

export type Aid = {
  feast: Feast;
  hijriYear: number;
  /** yyyy-mm-dd, first day according to the calendar estimate. */
  estimatedStart: string;
  /** yyyy-mm-dd, first day actually applied. */
  start: string;
  confirmed: boolean;
  /** The two days off. */
  days: [string, string];
};

type Estimate = Pick<Aid, "feast" | "hijriYear" | "estimatedStart">;

const DAY_MS = 86_400_000;

export function addDays(iso: string, n: number): string {
  return new Date(Date.parse(iso) + n * DAY_MS).toISOString().slice(0, 10);
}

const hijri = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const cache = new Map<number, Estimate[]>();

/** The Aïds starting in one Gregorian year (a year can hold the same Aïd twice). */
function estimatesOfYear(year: number): Estimate[] {
  const hit = cache.get(year);
  if (hit) return hit;

  const list: Estimate[] = [];
  for (let t = Date.UTC(year, 0, 1); t < Date.UTC(year + 1, 0, 1); t += DAY_MS) {
    const parts = hijri.formatToParts(t);
    const part = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? "", 10);
    const month = part("month");
    const day = part("day");
    // 1 Chawwal = Aïd al-Fitr, 10 Dhou al-Hijja = Aïd al-Adha.
    const feast = month === 10 && day === 1 ? "FITR" : month === 12 && day === 10 ? "ADHA" : null;
    if (feast) {
      list.push({ feast, hijriYear: part("year"), estimatedStart: new Date(t).toISOString().slice(0, 10) });
    }
  }
  cache.set(year, list);
  return list;
}

export function buildAids(
  fromYear: number,
  toYear: number,
  confirmations: { feast: string; hijriYear: number; startDate: string }[],
): Aid[] {
  const confirmedStart = new Map(confirmations.map((c) => [`${c.feast}-${c.hijriYear}`, c.startDate]));
  const aids: Aid[] = [];
  for (let year = fromYear; year <= toYear; year++) {
    for (const e of estimatesOfYear(year)) {
      const confirmed = confirmedStart.get(`${e.feast}-${e.hijriYear}`);
      const start = confirmed ?? e.estimatedStart;
      aids.push({ ...e, start, confirmed: Boolean(confirmed), days: [start, addDays(start, 1)] });
    }
  }
  return aids;
}

/** The Aïd days in the same shape as the other jours fériés. */
export function aidHolidays(aids: Aid[]): Holiday[] {
  return aids.flatMap((a) =>
    a.days.map((date) => ({
      date,
      label: a.confirmed ? FEAST_LABELS[a.feast] : `${FEAST_LABELS[a.feast]} (prévisionnel)`,
    })),
  );
}
