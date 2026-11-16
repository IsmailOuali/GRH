"use client";

import { useRef, useState, useMemo } from "react";
import { businessDaysBetween, nextBusinessDayIso, formatFrIso } from "@/lib/dates";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage } from "@/components/ui/Field";
import { controlClass } from "@/components/ui/control";
import {
  STANDARD_LEAVE_TYPES,
  SPECIAL_LEAVE_TYPES,
  isSpecialLeave,
  specialLeaveEntitlement,
} from "@/lib/leave-types";
import { submitLeaveRequest } from "./actions";

export function LeaveForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [type, setType] = useState(STANDARD_LEAVE_TYPES[0].value);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const special = isSpecialLeave(type);
  const droit = specialLeaveEntitlement(type);

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
      setType(STANDARD_LEAVE_TYPES[0].value);
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
          <select
            {...props}
            name="type"
            required
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={controlClass}
          >
            <optgroup label="Congés">
              {STANDARD_LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </optgroup>
            <optgroup label="Congés spéciaux (événements familiaux)">
              {SPECIAL_LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </optgroup>
          </select>
        )}
      </Field>

      {special && (
        <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800 ring-1 ring-inset ring-sky-200">
          Congé spécial : il n&apos;est pas déduit de votre solde CP/RTT. Droit habituel :{" "}
          <strong>{droit} jour{droit && droit > 1 ? "s" : ""}</strong>. Un justificatif pourra vous être demandé.
        </p>
      )}

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

      {special && droit !== undefined && days !== null && days > droit && (
        <p role="status" className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
          Cette période dépasse le droit habituel ({droit} jour{droit > 1 ? "s" : ""}). Votre responsable décidera de la suite.
        </p>
      )}

      <Field
        label="Commentaire"
        hint={special ? "Précisez l'événement (lien de parenté, date…)." : "Optionnel — précisez le contexte si utile."}
      >
        {(props) => <textarea {...props} name="comment" rows={3} className={controlClass} />}
      </Field>

      {msg && <FormMessage type={msg.type}>{msg.text}</FormMessage>}

      <Button type="submit" loading={loading} fullWidth>
        Soumettre la demande
      </Button>
    </form>
  );
}
