"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Users, ChevronDown, X } from "lucide-react";
import { PlanningCalendar } from "@/components/PlanningCalendar";
import type { PlanningEntry } from "@/lib/planning";
import type { PlanningPerson } from "@/components/PlanningCalendar";
import { Card, CardEyebrow } from "@/components/ui/Card";

export function AbsenceTeamCard({
  count,
  employees,
  absences,
  people = [],
  currentUserId,
  teamIds,
}: {
  count: number;
  employees: string[];
  absences: PlanningEntry[];
  people?: PlanningPerson[];
  currentUserId?: string;
  teamIds?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Close on Escape while the modal is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <Card className="p-5">
      <CardEyebrow icon={Users} tone="violet">
        Absences équipe aujourd&apos;hui
      </CardEyebrow>
      <button
        onClick={() => setOpen(true)}
        className="press mt-4 flex items-baseline gap-1.5 rounded-lg text-left transition-opacity hover:opacity-70"
        aria-label="Voir le calendrier des absences"
      >
        <span className="text-[2rem] font-bold leading-none tabular-nums tracking-tight text-slate-900 dark:text-white">{count}</span>
        <span className="text-sm text-slate-500 dark:text-neutral-400">
          {count === 1 ? "personne" : "personnes"}
        </span>
        <ChevronDown className="size-4 self-center text-slate-400 dark:text-neutral-500" aria-hidden />
      </button>

      {employees.length > 0 && (
        <p className="mt-2 truncate text-xs text-slate-500 dark:text-neutral-400">{employees.join(", ")}</p>
      )}

      <button
        onClick={() => setOpen(true)}
        className="press mt-4 rounded-lg text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300"
      >
        Voir le calendrier →
      </button>

      {open && mounted &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Calendrier des absences"
            className="fixed inset-0 z-50 animate-fade-in overflow-auto bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            {/* w-max lets the scroll area grow to the fixed calendar; min-w-full keeps
                it centered when the screen is wider. The calendar never resizes. */}
            <div className="flex min-h-full w-max min-w-full items-start justify-center p-4 sm:items-center">
              <div className="relative w-[min(1240px,92vw)]" onClick={(e) => e.stopPropagation()}>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white drop-shadow">
                    Planning de l&apos;équipe
                  </h2>
                  <button
                    onClick={() => setOpen(false)}
                    className="grid size-9 place-items-center rounded-full bg-white/90 text-slate-600 shadow-raised transition-colors hover:bg-white"
                    aria-label="Fermer"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
                <PlanningCalendar
                  entries={absences}
                  people={people}
                  currentUserId={currentUserId}
                  teamIds={teamIds}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </Card>
  );
}
