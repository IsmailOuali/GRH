"use client";

import { useRef, useState, useMemo } from "react";
import { businessDaysBetween, nextBusinessDayIso, formatFrIso } from "@/lib/dates";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage } from "@/components/ui/Field";
import { controlClass } from "@/components/ui/control";
import { submitLeaveRequest } from "./actions";

const TYPES = [
  { value: "CP",         label: "Congés Payés" },
  { value: "RTT",        label: "RTT" },
  { value: "MALADIE",    label: "Maladie" },
  { value: "SANS_SOLDE", label: "Sans Solde" },
];

export function LeaveForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const days = useMemo(() => {
    if (!startDate || !endDate) return null;
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (e < s) return null;
    return businessDaysBetween(s, e);
  }, [startDate, endDate]);

  // Date de reprise = premier jour ouvré après la date de fin (verrouillée).
  const returnDate = useMemo(() => (endDate ? nextBusinessDayIso(endDate) : ""), [endDate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const result = await submitLeaveRequest(new FormData(ref.current!));
    if (result.success) {
      setMsg({ type: "ok", text: "Demande envoyée avec succès." });
      ref.current?.reset();
      setStartDate("");
      setEndDate("");
    } else {
      setMsg({ type: "err", text: result.error ?? "Erreur." });
    }
    setLoading(false);
  }

  return (
    <form ref={ref} onSubmit={handleSubmit} className="space-y-4">
      <Field label="Type" required>
        {(props) => (
          <select {...props} name="type" required className={controlClass}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        )}
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date de début" required>
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
        <Field label="Date de fin" required>
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

      {/* Derived, non-editable: shown as a summary rather than as two dead
          inputs, so nothing invites a click that does nothing. */}
      <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200/70">
        <div>
          <dt className="text-xs font-medium text-slate-500">Jours ouvrés</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-slate-800">
            {days === null ? "—" : `${days} jour${days > 1 ? "s" : ""}`}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Date de reprise</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-slate-800">
            {returnDate ? formatFrIso(returnDate) : "—"}
          </dd>
        </div>
      </dl>

      <Field label="Commentaire" hint="Optionnel — précisez le contexte si utile.">
        {(props) => <textarea {...props} name="comment" rows={3} className={controlClass} />}
      </Field>

      {msg && <FormMessage type={msg.type}>{msg.text}</FormMessage>}

      <Button type="submit" loading={loading} fullWidth>
        Soumettre la demande
      </Button>
    </form>
  );
}
