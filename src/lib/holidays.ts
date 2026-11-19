/**
 * Jours fériés — France métropolitaine (les 11 jours fériés légaux).
 *
 * Computed, never stored: the fixed dates are constants and the three
 * Easter-based ones (lundi de Pâques, Ascension, lundi de Pentecôte) come from
 * the Gregorian Easter algorithm, so every year — past or future — is right
 * without any yearly update.
 *
 * For now they are only DISPLAYED (planning). They are deliberately not
 * excluded from day counts: leave-day counting stays in dates.ts.
 *
 * Not covered on purpose: Alsace-Moselle (Vendredi saint, 26 décembre) and
 * other local holidays.
 */

import { toIso } from "@/lib/dates";

export type Holiday = {
  /** yyyy-mm-dd */
  date: string;
  label: string;
};

/** Easter Sunday (Gregorian calendar), anonymous / Meeus-Jones-Butcher algorithm. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = mars, 4 = avril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const cache = new Map<number, Holiday[]>();

/** The 11 jours fériés of `year`, in date order. */
export function frenchHolidays(year: number): Holiday[] {
  const hit = cache.get(year);
  if (hit) return hit;

  const easter = easterSunday(year);
  const fromEaster = (days: number) =>
    toIso(new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + days));
  const fixed = (month: number, day: number) => toIso(new Date(year, month - 1, day));

  const list: Holiday[] = [
    { date: fixed(1, 1), label: "Jour de l'An" },
    { date: fromEaster(1), label: "Lundi de Pâques" },
    { date: fixed(5, 1), label: "Fête du Travail" },
    { date: fixed(5, 8), label: "Victoire 1945" },
    { date: fromEaster(39), label: "Ascension" },
    { date: fromEaster(50), label: "Lundi de Pentecôte" },
    { date: fixed(7, 14), label: "Fête nationale" },
    { date: fixed(8, 15), label: "Assomption" },
    { date: fixed(11, 1), label: "Toussaint" },
    { date: fixed(11, 11), label: "Armistice 1918" },
    { date: fixed(12, 25), label: "Noël" },
  ].sort((x, y) => x.date.localeCompare(y.date));

  cache.set(year, list);
  return list;
}

/** Jours fériés of one month (`month` is 1-based). */
export function holidaysOfMonth(year: number, month: number): Holiday[] {
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  return frenchHolidays(year).filter((h) => h.date.startsWith(prefix));
}
