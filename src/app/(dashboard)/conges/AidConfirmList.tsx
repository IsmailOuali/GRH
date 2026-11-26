"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { controlClass } from "@/components/ui/control";
import { addDays, FEAST_LABELS, MAX_AID_SHIFT_DAYS, type Aid } from "@/lib/aid";
import { formatFrIso } from "@/lib/dates";
import { confirmAid } from "./aid-actions";
import { useFeedback } from "@/lib/toast";

export function AidConfirmList({ aids }: { aids: Aid[] }) {
  return (
    <div className="max-w-xl space-y-3">
      <p className="text-sm text-slate-600">
        Les dates sont estimées à l&apos;avance. Confirmez le premier jour dès son annonce : le second suit
        automatiquement. La confirmation s&apos;applique à toutes les sociétés, recalcule les demandes de congé
        concernées et prévient tous les salariés.
      </p>
      {aids.map((a) => (
        <AidRow key={`${a.feast}-${a.hijriYear}`} aid={a} />
      ))}
    </div>
  );
}

function AidRow({ aid }: { aid: Aid }) {
  const [start, setStart] = useState(aid.start);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useFeedback();
  const label = `${FEAST_LABELS[aid.feast]} ${aid.estimatedStart.slice(0, 4)}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !start) return;
    const second = formatFrIso(addDays(start, 1));
    if (!window.confirm(`Confirmer ${label} les ${formatFrIso(start)} et ${second} ? Tous les salariés seront prévenus.`))
      return;

    setLoading(true);
    setMsg(null);
    try {
      const body = new FormData();
      body.set("feast", aid.feast);
      body.set("hijriYear", String(aid.hijriYear));
      body.set("startDate", start);
      const result = await confirmAid(body);
      if (result.success) {
        const pdf = result.pdfFailures ? ` ${result.pdfFailures} attestation(s) PDF non régénérée(s).` : "";
        setMsg({ type: "ok", text: `Date confirmée. ${result.recalculated} demande(s) recalculée(s).${pdf}` });
      } else {
        setMsg({ type: "err", text: result.error ?? "Erreur." });
      }
    } catch {
      setMsg({ type: "err", text: "Impossible de contacter le serveur." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-900/[0.07]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            aid.confirmed ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
          }`}
        >
          {aid.confirmed ? "Confirmé" : "Prévisionnel"}
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-slate-500">
          Premier jour
          <input
            type="date"
            required
            value={start}
            min={addDays(aid.estimatedStart, -MAX_AID_SHIFT_DAYS)}
            max={addDays(aid.estimatedStart, MAX_AID_SHIFT_DAYS)}
            onChange={(e) => setStart(e.target.value)}
            className={`${controlClass} mt-1`}
          />
        </label>
        <p className="pb-2 text-sm tabular-nums text-slate-600">
          Second jour : {start ? formatFrIso(addDays(start, 1)) : "—"}
        </p>
        <Button type="submit" loading={loading} disabled={!start || (aid.confirmed && start === aid.start)}>
          {aid.confirmed ? "Modifier" : "Confirmer"}
        </Button>
      </div>
      {msg?.type === "err" && <FormMessage type="err">{msg.text}</FormMessage>}
    </form>
  );
}
