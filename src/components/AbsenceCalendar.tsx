"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

export interface CalendarAbsence {
  name: string;
  type: string;
  start: string; // yyyy-mm-dd (inclusive)
  end: string; // yyyy-mm-dd (inclusive)
}

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const TYPE_LABELS: Record<string, string> = {
  CP: "Congés Payés", RTT: "RTT", MALADIE: "Maladie", SANS_SOLDE: "Sans Solde",
};
const TYPE_CLASS: Record<string, string> = {
  CP: "bg-indigo-100 text-indigo-700",
  RTT: "bg-violet-100 text-violet-700",
  MALADIE: "bg-rose-100 text-rose-700",
  SANS_SOLDE: "bg-amber-100 text-amber-700",
};

/** How many name chips fit in a fixed-height day cell before we collapse to "+N". */
const MAX_VISIBLE = 3;

/** Always render 6 week-rows so the calendar height is identical for 28/29/30/31-day months. */
const TOTAL_CELLS = 42;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function AbsenceCalendar({ absences }: { absences: CalendarAbsence[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const { year, month } = cursor;
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  // Leading blanks so the 1st lands under the right weekday (Mon-based).
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = Monday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  type DayCell = { day: number; iso: string; absent: CalendarAbsence[] };

  // 42 slots (6 rows × 7): leading blanks, the days, then trailing blanks.
  const slots = useMemo(() => {
    const list: (DayCell | null)[] = Array.from({ length: firstDow }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${pad(month + 1)}-${pad(d)}`;
      const absent = absences.filter((a) => a.start <= iso && iso <= a.end);
      list.push({ day: d, iso, absent });
    }
    while (list.length < TOTAL_CELLS) list.push(null);
    return list;
  }, [absences, year, month, daysInMonth, firstDow]);

  function shift(delta: number) {
    setCursor(({ year, month }) => {
      const m = month + delta;
      return { year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  }

  const monthTotal = slots.reduce((acc, c) => acc + (c?.absent.length ?? 0), 0);

  return (
    // Fixed grid size; on mobile the card takes full width and the grid
    // scrolls horizontally inside it instead of overflowing the page.
    <div className="w-full max-w-full rounded-xl border border-slate-200 bg-white shadow-sm md:w-fit">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-slate-400" />
          <h2 className="font-medium text-slate-700">
            {MONTHS[month]} {year}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => shift(-1)}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() })}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Aujourd&apos;hui
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

      <div className="overflow-x-auto p-4">
        <div className="grid grid-cols-[repeat(7,80px)] gap-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="pb-1 text-center text-xs font-medium text-slate-500">
              {w}
            </div>
          ))}

          {slots.map((c, idx) => {
            if (c === null) return <div key={`blank-${idx}`} className="h-[84px]" />;
            const isToday = c.iso === todayIso;
            const visible = c.absent.slice(0, MAX_VISIBLE);
            const hidden = c.absent.slice(MAX_VISIBLE);
            return (
              <div
                key={c.iso}
                className={`h-[84px] overflow-hidden rounded-lg border p-1.5 ${
                  isToday ? "border-indigo-300 bg-indigo-50/40" : "border-slate-100"
                }`}
              >
                <div className={`mb-1 text-right text-xs ${isToday ? "font-semibold text-indigo-600" : "text-slate-500"}`}>
                  {c.day}
                </div>
                <div className="space-y-0.5">
                  {visible.map((a, i) => (
                    <div
                      key={i}
                      title={`${a.name} — ${TYPE_LABELS[a.type] ?? a.type}`}
                      className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${TYPE_CLASS[a.type] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {a.name}
                    </div>
                  ))}
                  {hidden.length > 0 && (
                    <div
                      title={hidden.map((a) => a.name).join(", ")}
                      className="rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-500"
                    >
                      +{hidden.length}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {monthTotal === 0 && (
          <p className="mt-4 text-center text-sm text-slate-500">
            Aucune absence validée ce mois-ci.
          </p>
        )}
      </div>
    </div>
  );
}
