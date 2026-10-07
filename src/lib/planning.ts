/**
 * The unified planning: congés and télétravail normalised into one stream of
 * per-person, per-day entries.
 *
 * The two stay in separate tables on purpose. A congé is requested, validated,
 * decrements a balance and produces an attestation; a jour de télétravail is
 * assigned outright. Merging the storage would force one workflow onto both.
 * They are merged HERE instead, at read time, so a single calendar can show
 * them together without either feature changing.
 *
 * The `countsAsWorked` flag is the distinction that makes that safe: a jour de
 * télétravail is a PRESENCE (the person is working, from home), not an
 * absence. It is never deducted from a leave balance and never counted in an
 * absence total.
 */

import { parseLocalDate, toIso } from "@/lib/dates";

export type PlanningType = "CP" | "RTT" | "MALADIE" | "SANS_SOLDE" | "TELETRAVAIL";
export type PlanningStatus = "APPROVED" | "PENDING";

export type PlanningEntry = {
  id: string;
  userId: string;
  name: string;
  /** yyyy-mm-dd — one entry per person per day; ranges are expanded. */
  date: string;
  type: PlanningType;
  status: PlanningStatus;
  /** True when the day is worked (télétravail). False for real absences. */
  countsAsWorked: boolean;
  note: string | null;
};

export type TypeMeta = {
  /** 2–3 letter code shown in the cell, so identity never rests on colour. */
  code: string;
  label: string;
  countsAsWorked: boolean;
  /** Tailwind classes for an approved cell. */
  cell: string;
  /** Legend swatch. */
  swatch: string;
};

/**
 * Colours follow the conventions already used elsewhere in the product
 * (AbsenceCalendar's leave palette, télétravail's teal), so the merged view
 * does not re-teach anything.
 */
export const TYPE_META: Record<PlanningType, TypeMeta> = {
  CP: {
    code: "CP", label: "Congés payés", countsAsWorked: false,
    cell: "bg-indigo-100 text-indigo-800", swatch: "bg-indigo-400",
  },
  RTT: {
    code: "RTT", label: "RTT", countsAsWorked: false,
    cell: "bg-violet-100 text-violet-800", swatch: "bg-violet-400",
  },
  MALADIE: {
    code: "MAL", label: "Maladie", countsAsWorked: false,
    cell: "bg-rose-100 text-rose-800", swatch: "bg-rose-400",
  },
  SANS_SOLDE: {
    code: "SS", label: "Sans solde", countsAsWorked: false,
    cell: "bg-amber-100 text-amber-800", swatch: "bg-amber-400",
  },
  TELETRAVAIL: {
    code: "TT", label: "Télétravail", countsAsWorked: true,
    cell: "bg-teal-100 text-teal-800", swatch: "bg-teal-400",
  },
};

export const PLANNING_TYPES = Object.keys(TYPE_META) as PlanningType[];

function isPlanningType(v: string): v is PlanningType {
  return v in TYPE_META;
}

type LeaveLike = {
  id: string;
  userId: string;
  type: string;
  status: string;
  startDate: Date;
  endDate: Date;
  comment: string | null;
  user: { name: string };
};

type RemoteLike = {
  id: string;
  userId: string;
  date: string;
  note: string | null;
  /** Absent on rows read before the status column existed — treat as approved. */
  status?: string;
  user: { name: string };
};

/**
 * Expands leave ranges into one entry per calendar day.
 *
 * Every day in the range is emitted, weekends included: the planning shows
 * what a period covers, and silently dropping the Saturday out of a
 * Friday-to-Monday congé would make the bar look wrong. The calendar greys
 * non-working columns itself, which reads correctly without falsifying the
 * span. Day-COUNTING for balances is a different question and stays in
 * businessDaysBetween.
 */
export function buildPlanningEntries(
  leaves: LeaveLike[],
  remoteDays: RemoteLike[],
): PlanningEntry[] {
  const entries: PlanningEntry[] = [];

  for (const l of leaves) {
    if (!isPlanningType(l.type)) continue;
    if (l.status !== "APPROVED" && l.status !== "PENDING") continue;

    const cur = new Date(l.startDate);
    const end = new Date(l.endDate);
    while (cur <= end) {
      entries.push({
        id: `${l.id}-${toIso(cur)}`,
        userId: l.userId,
        name: l.user.name,
        date: toIso(cur),
        type: l.type,
        status: l.status as PlanningStatus,
        countsAsWorked: false,
        note: l.comment,
      });
      cur.setDate(cur.getDate() + 1);
    }
  }

  for (const r of remoteDays) {
    // REJECTED rows are deleted rather than kept, so anything present is
    // either a manager assignment or a request awaiting validation.
    if (r.status === "REJECTED") continue;
    entries.push({
      id: r.id,
      userId: r.userId,
      name: r.user.name,
      date: r.date,
      status: r.status === "PENDING" ? "PENDING" : "APPROVED",
      type: "TELETRAVAIL",
      countsAsWorked: true,
      note: r.note,
    });
  }

  return entries;
}

/** Distinct people appearing in the planning, plus anyone passed in
 *  explicitly so an employee with nothing booked still gets a row. */
export function planningPeople(
  entries: PlanningEntry[],
  always: { id: string; name: string }[] = [],
): { id: string; name: string }[] {
  const map = new Map<string, string>();
  for (const p of always) map.set(p.id, p.name);
  for (const e of entries) if (!map.has(e.userId)) map.set(e.userId, e.name);
  return [...map]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/** yyyy-mm-dd for every day of a month, 1-based `month`. */
export function monthDays(year: number, month: number): string[] {
  const count = new Date(year, month, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= count; d++) {
    out.push(toIso(new Date(year, month - 1, d)));
  }
  return out;
}

/** Local Date for a yyyy-mm-dd string, for weekday lookups in the grid. */
export function dayOfWeek(iso: string): number {
  return parseLocalDate(iso)?.getDay() ?? 0;
}
