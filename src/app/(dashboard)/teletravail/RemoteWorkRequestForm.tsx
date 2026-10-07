"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage } from "@/components/ui/Field";
import { controlClass, labelClass } from "@/components/ui/control";
import { expandRemoteDays, WEEKDAYS } from "@/lib/teletravail";
import { requestRemoteDays } from "./actions";

type Mode = "range" | "weekly";

/**
 * The employee's side of télétravail: ask for days, which land as PENDING
 * until a manager validates them.
 *
 * Deliberately close to RemoteWorkForm (the manager's assignment form) minus
 * the salarié picker — the server always uses the caller's own id, so there is
 * no userId in this form to tamper with.
 */
export function RemoteWorkRequestForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [mode, setMode] = useState<Mode>("range");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const dayCount = useMemo(() => {
    if (!startDate || !endDate) return null;
    return expandRemoteDays(startDate, endDate, mode === "weekly" ? weekdays : []).length;
  }, [startDate, endDate, mode, weekdays]);

  function toggle(value: number) {
    setWeekdays((w) => (w.includes(value) ? w.filter((v) => v !== value) : [...w, value]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "weekly" && weekdays.length === 0) {
      setMsg({ type: "err", text: "Sélectionnez au moins un jour de la semaine." });
      return;
    }

    setLoading(true);
    setMsg(null);
    const result = await requestRemoteDays(new FormData(ref.current!));
    setLoading(false);

    if ("error" in result) {
      setMsg({ type: "err", text: result.error });
      return;
    }

    const parts = [
      result.created > 0
        ? `Demande envoyée pour ${result.created} jour${result.created > 1 ? "s" : ""} — en attente de validation.`
        : "Aucun jour n'a pu être demandé.",
    ];
    if (result.skippedExisting > 0)
      parts.push(`${result.skippedExisting} déjà planifié(s) ou déjà demandé(s).`);
    if (result.skippedLeave > 0)
      parts.push(`${result.skippedLeave} ignoré(s) : congé validé sur ces dates.`);

    setMsg({ type: result.created > 0 ? "ok" : "err", text: parts.join(" ") });
    if (result.created > 0) {
      setWeekdays([]);
      setStartDate("");
      setEndDate("");
      ref.current?.reset();
      setMode("range");
    }
  }

  return (
    <form ref={ref} onSubmit={handleSubmit} className="space-y-5">
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
          <legend className={labelClass}>Jours souhaités</legend>
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
                    onChange={() => toggle(d.value)}
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

      <dl className="rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200/70">
        <dt className="text-xs font-medium text-slate-500">Jours demandés</dt>
        <dd className="mt-0.5 text-sm font-medium tabular-nums text-slate-800">
          {dayCount === null ? "—" : `${dayCount} jour${dayCount > 1 ? "s" : ""}`}
        </dd>
      </dl>

      <Field label="Motif" hint="Optionnel — précisez le contexte si utile.">
        {(props) => <input {...props} name="note" type="text" className={controlClass} />}
      </Field>

      {msg && <FormMessage type={msg.type}>{msg.text}</FormMessage>}

      <Button type="submit" loading={loading} fullWidth>
        Envoyer la demande
      </Button>
    </form>
  );
}
