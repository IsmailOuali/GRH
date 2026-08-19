"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage } from "@/components/ui/Field";
import { controlClass, labelClass } from "@/components/ui/control";
import { expandRemoteDays, WEEKDAYS } from "@/lib/teletravail";
import { assignRemoteDays } from "./actions";

export type Employee = { id: string; name: string; position: string | null };

type Mode = "range" | "weekly";

export function RemoteWorkForm({ employees }: { employees: Employee[] }) {
  const ref = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("range");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Same expansion the server runs, so the count previewed here is the count
  // that gets created (minus days already planned or covered by a congé).
  const dayCount = useMemo(() => {
    if (!startDate || !endDate) return null;
    return expandRemoteDays(startDate, endDate, mode === "weekly" ? weekdays : []).length;
  }, [startDate, endDate, mode, weekdays]);

  const allSelected = selected.length === employees.length && employees.length > 0;

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.length === 0) {
      setMsg({ type: "err", text: "Sélectionnez au moins un salarié." });
      return;
    }
    if (mode === "weekly" && weekdays.length === 0) {
      setMsg({ type: "err", text: "Sélectionnez au moins un jour de la semaine." });
      return;
    }

    setLoading(true);
    setMsg(null);
    const result = await assignRemoteDays(new FormData(ref.current!));
    setLoading(false);

    if ("error" in result) {
      setMsg({ type: "err", text: result.error });
      return;
    }

    const parts = [
      `${result.created} jour${result.created > 1 ? "s" : ""} de télétravail planifié${result.created > 1 ? "s" : ""}.`,
    ];
    if (result.skippedExisting > 0)
      parts.push(`${result.skippedExisting} déjà planifié(s), ignoré(s).`);
    if (result.skippedLeave > 0)
      parts.push(`${result.skippedLeave} ignoré(s) : congé validé sur ces dates.`);

    setMsg({ type: result.created > 0 ? "ok" : "err", text: parts.join(" ") });
    if (result.created > 0) {
      setSelected([]);
      setWeekdays([]);
      setStartDate("");
      setEndDate("");
      ref.current?.reset();
    }
  }

  if (employees.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucun salarié dans votre périmètre — ajoutez des collaborateurs avant de planifier du
        télétravail.
      </p>
    );
  }

  return (
    <form ref={ref} onSubmit={handleSubmit} className="space-y-5">
      {/* Employees — a checkbox list rather than a <select multiple>, because
          assigning the same rhythm to several people is the common case. */}
      <fieldset>
        <legend className={labelClass}>
          Salariés
          <span className="ml-0.5 text-red-500" aria-hidden>*</span>
        </legend>
        <div className="mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-slate-300 bg-white">
          <label className="flex cursor-pointer items-center gap-2.5 border-b border-slate-100 bg-slate-50/70 px-3 py-2.5 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? [] : employees.map((e) => e.id))}
              className="size-4 rounded border-slate-300 accent-brand-600 focus:ring-brand-500"
            />
            Tout sélectionner
          </label>
          {employees.map((emp) => (
            <label
              key={emp.id}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                name="userIds"
                value={emp.id}
                checked={selected.includes(emp.id)}
                onChange={() => setSelected((s) => toggle(s, emp.id))}
                className="size-4 rounded border-slate-300 accent-brand-600 focus:ring-brand-500"
              />
              <span className="truncate">
                {emp.name}
                {emp.position && <span className="text-slate-500"> · {emp.position}</span>}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          {selected.length} sélectionné{selected.length > 1 ? "s" : ""}
        </p>
      </fieldset>

      <Field label="Répétition">
        {(props) => (
          <select
            {...props}
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className={controlClass}
          >
            <option value="range">Tous les jours ouvrés de la période</option>
            <option value="weekly">Certains jours de la semaine (récurrent)</option>
          </select>
        )}
      </Field>

      {mode === "weekly" && (
        <fieldset>
          <legend className={labelClass}>Jours concernés</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const on = weekdays.includes(d.value);
              return (
                <label
                  key={d.value}
                  className={`cursor-pointer select-none rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors ${
                    on
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="weekdays"
                    value={d.value}
                    checked={on}
                    onChange={() => setWeekdays((w) => toggle(w, d.value))}
                    className="sr-only"
                  />
                  <span aria-label={d.label}>{d.short}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Du" required>
          {(props) => (
            <input
              {...props}
              name="startDate"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={controlClass}
            />
          )}
        </Field>
        <Field label="Au" required>
          {(props) => (
            <input
              {...props}
              name="endDate"
              type="date"
              required
              min={startDate || undefined}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={controlClass}
            />
          )}
        </Field>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200/70">
        <div>
          <dt className="text-xs font-medium text-slate-500">Jours par salarié</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-slate-800">
            {dayCount === null ? "—" : `${dayCount} jour${dayCount > 1 ? "s" : ""}`}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Total à créer</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-slate-800">
            {dayCount === null ? "—" : dayCount * selected.length}
          </dd>
        </div>
      </dl>

      <Field label="Note" hint="Optionnel — visible au survol dans le calendrier.">
        {(props) => <input {...props} name="note" type="text" className={controlClass} />}
      </Field>

      {msg && <FormMessage type={msg.type}>{msg.text}</FormMessage>}

      <Button type="submit" loading={loading} fullWidth>
        Planifier le télétravail
      </Button>
    </form>
  );
}
