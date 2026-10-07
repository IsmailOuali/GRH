"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarRange, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { isBusinessDay, parseLocalDate } from "@/lib/dates";
import {
  TYPE_META,
  PLANNING_TYPES,
  dayOfWeek,
  monthDays,
  planningPeople,
  type PlanningEntry,
  type PlanningType,
} from "@/lib/planning";

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const DOW_INITIAL = ["D", "L", "M", "M", "J", "V", "S"];

type Presence = "all" | "worked" | "absent";
type StatusFilter = "all" | "APPROVED" | "PENDING";

export type PlanningPerson = { id: string; name: string };

/**
 * One planning for congés AND télétravail — rows are salariés, columns are
 * days of the month.
 *
 * Replaces the two month-grid calendars this app used to have. A month grid
 * puts every person for one day into a single cell, so it truncates ("+3")
 * exactly when a team gets big enough to need a planning; a timeline keeps one
 * row per person, so it scales and also answers "what does this person's month
 * look like", which the grid could not.
 *
 * Each cell carries a letter code as well as a colour, so the type is legible
 * without relying on colour perception.
 */
export function PlanningCalendar({
  entries,
  people = [],
  /** Pre-selected types — lets the télétravail page show only TT. */
  initialTypes,
  /** Hides the type filter when the caller has fixed the scope. */
  lockTypes = false,
  currentUserId,
  teamIds,
}: {
  entries: PlanningEntry[];
  people?: PlanningPerson[];
  initialTypes?: PlanningType[];
  lockTypes?: boolean;
  currentUserId?: string;
  teamIds?: string[];
}) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });
  const [types, setTypes] = useState<PlanningType[]>(initialTypes ?? PLANNING_TYPES);
  const [presence, setPresence] = useState<Presence>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [who, setWho] = useState<string>("all");

  const { year, month } = cursor;
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const days = useMemo(() => monthDays(year, month), [year, month]);

  const filtered = useMemo(() => {
    const team = teamIds ? new Set(teamIds) : null;
    return entries.filter((e) => {
      if (!e.date.startsWith(`${year}-${String(month).padStart(2, "0")}`)) return false;
      if (!types.includes(e.type)) return false;
      if (presence === "worked" && !e.countsAsWorked) return false;
      if (presence === "absent" && e.countsAsWorked) return false;
      if (status !== "all" && e.status !== status) return false;
      if (who === "me" && e.userId !== currentUserId) return false;
      if (who === "team" && team && !team.has(e.userId)) return false;
      if (who !== "all" && who !== "me" && who !== "team" && e.userId !== who) return false;
      return true;
    });
  }, [entries, year, month, types, presence, status, who, currentUserId, teamIds]);

  // Rows: everyone with something booked this month, plus the roster so an
  // empty row still shows — "nothing booked" is information on a planning.
  const rows = useMemo(() => {
    const roster =
      who === "all"
        ? people
        : who === "team" && teamIds
          ? people.filter((p) => teamIds.includes(p.id))
          : who === "me"
            ? people.filter((p) => p.id === currentUserId)
            : people.filter((p) => p.id === who);
    return planningPeople(filtered, roster);
  }, [filtered, people, who, teamIds, currentUserId]);

  // person → date → entry. Télétravail loses to a real absence on the same
  // day: if someone is off sick, that is the fact worth showing.
  const byPerson = useMemo(() => {
    const m = new Map<string, Map<string, PlanningEntry>>();
    for (const e of filtered) {
      let d = m.get(e.userId);
      if (!d) m.set(e.userId, (d = new Map()));
      const existing = d.get(e.date);
      if (!existing || (existing.countsAsWorked && !e.countsAsWorked)) d.set(e.date, e);
    }
    return m;
  }, [filtered]);

  function shift(delta: number) {
    setCursor(({ year, month }) => {
      const m = month - 1 + delta;
      return { year: year + Math.floor(m / 12), month: (((m % 12) + 12) % 12) + 1 };
    });
  }

  function toggleType(t: PlanningType) {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  const onCurrentMonth =
    year === today.getFullYear() && month === today.getMonth() + 1;

  const activeTypes = PLANNING_TYPES.filter((t) => types.includes(t));

  return (
    <div className="rounded-2xl bg-white shadow-card ring-1 ring-slate-900/[0.07]">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <CalendarRange className="size-4 text-slate-400" aria-hidden />
          <h2 className="text-[0.9375rem] font-semibold tracking-tight text-slate-900">
            {MONTHS[month - 1]} {year}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {/* Sits before the chevrons rather than between them: wedged in the
              middle it read as a third step of the same left/right control.
              Disabled on the current month so it states where you already are
              instead of looking broken when clicking does nothing. */}
          <button
            onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() + 1 })}
            disabled={onCurrentMonth}
            title={onCurrentMonth ? "Vous êtes sur le mois en cours" : "Revenir au mois en cours"}
            className="mr-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-default disabled:border-slate-100 disabled:text-slate-400 disabled:hover:bg-transparent"
          >
            <CalendarCheck className="size-3.5" aria-hidden />
            Aujourd&apos;hui
          </button>
          <button
            onClick={() => shift(-1)}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => shift(1)}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
            aria-label="Mois suivant"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-slate-100 px-5 py-3">
        <FilterGroup label="Salarié">
          <select
            value={who}
            onChange={(e) => setWho(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/15"
          >
            <option value="all">(Tous)</option>
            {teamIds && teamIds.length > 0 && <option value="team">(Mon équipe)</option>}
            {currentUserId && <option value="me">(Moi)</option>}
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </FilterGroup>

        {!lockTypes && (
          <FilterGroup label="Type">
            <div className="flex flex-wrap gap-1.5">
              {PLANNING_TYPES.map((t) => {
                const on = types.includes(t);
                const meta = TYPE_META[t];
                return (
                  <button
                    key={t}
                    onClick={() => toggleType(t)}
                    aria-pressed={on}
                    title={meta.label}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold transition-colors",
                      on
                        ? "border-slate-300 bg-white text-slate-700"
                        : "border-slate-200 bg-slate-50 text-slate-400",
                    )}
                  >
                    <span className={cn("size-2 rounded-sm", on ? meta.swatch : "bg-slate-300")} aria-hidden />
                    {meta.code}
                  </button>
                );
              })}
            </div>
          </FilterGroup>
        )}

        <FilterGroup label="Présence">
          <select
            value={presence}
            onChange={(e) => setPresence(e.target.value as Presence)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/15"
          >
            <option value="all">(Tous)</option>
            <option value="worked">Jours travaillés</option>
            <option value="absent">Jours non travaillés</option>
          </select>
        </FilterGroup>

        <FilterGroup label="Statut">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/15"
          >
            <option value="all">(Tous)</option>
            <option value="APPROVED">Validé</option>
            <option value="PENDING">En attente</option>
          </select>
        </FilterGroup>
      </div>

      {/* ── Timeline ───────────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-slate-500">
          Aucun salarié à afficher pour ces filtres.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {/* Sticky so the name stays readable while scrolling days. */}
                <th className="sticky left-0 z-10 min-w-[150px] bg-white px-4 py-2 text-left th-label">
                  Salarié
                </th>
                {days.map((iso) => {
                  const d = parseLocalDate(iso)!;
                  const off = !isBusinessDay(d);
                  return (
                    <th
                      key={iso}
                      className={cn(
                        "w-7 min-w-[28px] border-l border-slate-100 px-0 py-2 text-center text-[10px] font-semibold",
                        off ? "bg-slate-100/70 text-slate-400" : "text-slate-500",
                        iso === todayIso && "bg-brand-50 text-brand-700",
                      )}
                    >
                      <span className="block leading-tight">{DOW_INITIAL[dayOfWeek(iso)]}</span>
                      <span className="block leading-tight tabular-nums">{d.getDate()}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => {
                const dayMap = byPerson.get(p.id);
                return (
                  <tr key={p.id}>
                    <td className="sticky left-0 z-10 truncate bg-white px-4 py-1.5 font-medium text-slate-800">
                      {p.name}
                    </td>
                    {days.map((iso) => {
                      const e = dayMap?.get(iso);
                      const off = !isBusinessDay(parseLocalDate(iso)!);
                      const meta = e ? TYPE_META[e.type] : null;
                      return (
                        <td
                          key={iso}
                          title={e ? `${p.name} — ${meta!.label}${e.status === "PENDING" ? " (en attente)" : ""}${e.note ? ` · ${e.note}` : ""}` : undefined}
                          className={cn(
                            "border-l border-slate-100 p-0 text-center",
                            !e && off && "bg-slate-100/70",
                          )}
                        >
                          {e && (
                            <span
                              className={cn(
                                "mx-auto my-0.5 flex h-6 items-center justify-center rounded text-[10px] font-bold",
                                meta!.cell,
                                // Pending is outlined and dimmed rather than a
                                // different hue — the type still has to read.
                                e.status === "PENDING" &&
                                  "bg-transparent opacity-90 ring-1 ring-inset ring-current ring-dashed",
                              )}
                            >
                              {meta!.code}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-600">
        {activeTypes.map((t) => {
          const meta = TYPE_META[t];
          return (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span className={cn("grid size-4 place-items-center rounded text-[9px] font-bold", meta.cell)}>
                {meta.code}
              </span>
              {meta.label}
              {meta.countsAsWorked && <span className="text-slate-400">· jour travaillé</span>}
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1.5">
          <span className="grid size-4 place-items-center rounded ring-1 ring-inset ring-slate-400 ring-dashed" aria-hidden />
          En attente de validation
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-4 rounded bg-slate-100" aria-hidden />
          Week-end
        </span>
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </div>
  );
}
