"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Laptop } from "lucide-react";

export interface RemoteWorkEntry {
  id: string;
  name: string;
  date: string; // yyyy-mm-dd
  note: string | null;
}

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/** How many name chips fit in a fixed-height day cell before we collapse to "+N". */
const MAX_VISIBLE = 3;

/** Always render 6 week-rows so the calendar height is identical for every month. */
const TOTAL_CELLS = 42;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Month grid of télétravail days — one chip per salarié on the day they work
 * remotely. Deliberately separate from AbsenceCalendar: those are ranges with
 * a type colour, these are single days that all read the same (teal), so the
 * two never compete for meaning inside one grid.
 */
export function RemoteWorkCalendar({ entries }: { entries: RemoteWorkEntry[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const { year, month } = cursor;
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  // Leading blanks so the 1st lands under the right weekday (Mon-based).
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = Monday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  type DayCell = { day: number; iso: string; weekend: boolean; remote: RemoteWorkEntry[] };

  const slots = useMemo(() => {
    const byDate = new Map<string, RemoteWorkEntry[]>();
    for (const e of entries) {
      const bucket = byDate.get(e.date);
      if (bucket) bucket.push(e);
      else byDate.set(e.date, [e]);
    }
    for (const bucket of byDate.values()) bucket.sort((a, b) => a.name.localeCompare(b.name, "fr"));

    const list: (DayCell | null)[] = Array.from({ length: firstDow }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${pad(month + 1)}-${pad(d)}`;
      const dow = new Date(year, month, d).getDay();
      list.push({ day: d, iso, weekend: dow === 0 || dow === 6, remote: byDate.get(iso) ?? [] });
    }
    while (list.length < TOTAL_CELLS) list.push(null);
    return list;
  }, [entries, year, month, daysInMonth, firstDow]);

  function shift(delta: number) {
    setCursor(({ year, month }) => {
      const m = month + delta;
      return { year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  }

  const monthTotal = slots.reduce((acc, c) => acc + (c?.remote.length ?? 0), 0);

  return (
    // Fixed grid size; on mobile the card takes full width and the grid
    // scrolls horizontally inside it instead of overflowing the page.
    <div className="w-full max-w-full rounded-xl border border-slate-200 bg-white shadow-sm md:w-fit">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <Laptop className="size-4 text-slate-400" />
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
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="pb-1 text-center text-xs font-medium text-slate-500">
              {w}
            </div>
          ))}

          {slots.map((c, idx) => {
            if (c === null) return <div key={`blank-${idx}`} className="h-[84px]" />;
            const isToday = c.iso === todayIso;
            const visible = c.remote.slice(0, MAX_VISIBLE);
            const hidden = c.remote.slice(MAX_VISIBLE);
            return (
              <div
                key={c.iso}
                className={`h-[84px] overflow-hidden rounded-lg border p-1.5 ${
                  isToday
                    ? "border-teal-300 bg-teal-50/40"
                    : c.weekend
                      ? "border-slate-100 bg-slate-50/60"
                      : "border-slate-100"
                }`}
              >
                <div
                  className={`mb-1 text-right text-xs ${
                    isToday ? "font-semibold text-teal-700" : "text-slate-500"
                  }`}
                >
                  {c.day}
                </div>
                <div className="space-y-0.5">
                  {visible.map((e) => (
                    <div
                      key={e.id}
                      title={e.note ? `${e.name} — ${e.note}` : `${e.name} — Télétravail`}
                      className="truncate rounded bg-teal-100 px-1.5 py-0.5 text-[11px] font-medium text-teal-800"
                    >
                      {e.name}
                    </div>
                  ))}
                  {hidden.length > 0 && (
                    <div
                      title={hidden.map((e) => e.name).join(", ")}
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
            Aucun jour de télétravail ce mois-ci.
          </p>
        )}
      </div>
    </div>
  );
}
