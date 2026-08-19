"use client";

import { useState, useMemo, useEffect } from "react";
import { Download, Loader2, Send, UserSearch } from "lucide-react";
import { TEMPLATES, type TemplateConfig } from "@/lib/documents/templates.config";
import { submitDocumentRequest, getDossierPrefill } from "@/app/(dashboard)/documents/actions";

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/20";
const LABEL_CLASS = "mb-1 block text-sm font-medium text-slate-700";

function businessDays(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/** Parse a `yyyy-mm-dd` string as a LOCAL date (avoids UTC off-by-one). */
function parseLocalDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Next weekday strictly after `iso` (skips Sat/Sun) — the "date de reprise". */
function nextBusinessDay(iso: string): string {
  const d = parseLocalDate(iso);
  if (!d) return "";
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return toIso(d);
}

/** `yyyy-mm-dd` → `dd/mm/yyyy` for read-only display. */
function formatFr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// Fields that map to the logged-in user's full name
const NAME_FIELDS = ["nom_salarie", "nom_prenom"];

interface Props {
  dynamicData?: Record<string, string[]>;
  sessionUser?: { id?: string; name: string; role: string };
  mode?: "generate" | "request";
  /** Company employee accounts, used to pre-fill a form from a linked dossier. */
  employees?: { id: string; name: string }[];
  /**
   * Today as `yyyy-mm-dd`, resolved on the SERVER. Passed in rather than
   * computed here so SSR and hydration always agree (a client in a different
   * timezone could otherwise render a different day and mismatch).
   */
  today: string;
}

function getInitialFields(
  templateFields: TemplateConfig["fields"],
  sessionName: string,
  today: string,
) {
  const initial: Record<string, string> = {};
  templateFields.forEach((f) => {
    if (NAME_FIELDS.includes(f.name)) initial[f.name] = sessionName;
    else if (f.defaultToday) initial[f.name] = today;
  });
  return initial;
}

const SELECTABLE_TEMPLATES = TEMPLATES.filter((t) => !t.hidden);

export function DocumentForm({ dynamicData = {}, sessionUser, mode = "generate", employees = [], today }: Props) {
  const [templateId, setTemplateId] = useState<string>(SELECTABLE_TEMPLATES[0].id);
  const [fields, setFields] = useState<Record<string, string>>(
    () => getInitialFields(SELECTABLE_TEMPLATES[0].fields, sessionUser?.name ?? "", today),
  );
  const [prefillId, setPrefillId] = useState("");
  const [prefilling, setPrefilling] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isEmployee = sessionUser?.role === "EMPLOYEE";
  const canPickEmployee = !isEmployee && employees.length > 0;
  const template: TemplateConfig = TEMPLATES.find((t) => t.id === templateId)!;

  // Derive computed fields (readOnly) from editable fields — no setState, no loop
  const computedFields = useMemo(() => {
    const result: Record<string, string> = {};
    template.fields.forEach((field) => {
      if (!field.readOnly) return;
      if (field.computedFrom) {
        const [startKey, endKey] = field.computedFrom;
        const startVal = fields[startKey];
        const endVal = fields[endKey];
        if (!startVal || !endVal) return;
        const s = new Date(startVal);
        const e = new Date(endVal);
        if (e < s) return;
        result[field.name] = String(businessDays(s, e));
      } else if (field.computeReturnDate) {
        const endVal = fields[field.computeReturnDate];
        if (endVal) result[field.name] = nextBusinessDay(endVal);
      }
    });
    return result;
  }, [fields, template]);

  // Employee (self) view: auto-fill from own linked dossier when the template
  // (re)mounts or changes. Managers use the explicit picker instead.
  useEffect(() => {
    if (!isEmployee || !sessionUser?.id) return;
    let cancelled = false;
    getDossierPrefill(sessionUser.id).then((extra) => {
      if (!cancelled) setFields((prev) => ({ ...prev, ...extra }));
    });
    return () => {
      cancelled = true;
    };
  }, [templateId, isEmployee, sessionUser?.id]);

  function handleTemplateChange(id: string) {
    const newTemplate = TEMPLATES.find((t) => t.id === id)!;
    setTemplateId(id);
    setFields(getInitialFields(newTemplate.fields, sessionUser?.name ?? "", today));
    setPrefillId("");
    setError(null);
  }

  function handleField(name: string, value: string) {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  // Manager picker: set the subject's name from the account, then merge in the
  // rest from their linked dossier (CIN, CNSS, poste, date d'intégration, …).
  async function handlePrefillSelect(userId: string) {
    setPrefillId(userId);
    if (!userId) return;
    const account = employees.find((e) => e.id === userId);
    const namePatch: Record<string, string> = {};
    if (account) for (const f of NAME_FIELDS) namePatch[f] = account.name;
    setFields((prev) => ({ ...prev, ...namePatch }));

    setPrefilling(true);
    try {
      const extra = await getDossierPrefill(userId);
      setFields((prev) => ({ ...prev, ...namePatch, ...extra }));
    } finally {
      setPrefilling(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === "request") {
        const result = await submitDocumentRequest(templateId, { ...fields, ...computedFields });
        if (result.error) { setError(result.error); return; }
        setSuccess("Demande envoyée. Vous serez notifié une fois traitée.");
        handleTemplateChange(templateId); // reset fields
        return;
      }

      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, fields: { ...fields, ...computedFields } }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        setError(json.error ?? "Erreur lors de la génération.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${templateId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Template selector */}
      <div>
        <label className={LABEL_CLASS}>Type de document</label>
        <select
          value={templateId}
          onChange={(e) => handleTemplateChange(e.target.value)}
          className={INPUT_CLASS}
        >
          {SELECTABLE_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Manager pre-fill from a linked dossier */}
      {canPickEmployee && (
        <div className="rounded-lg border border-brand-100 bg-brand-50/50 p-4">
          <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
            <UserSearch className="size-4 text-brand-500" />
            Pré-remplir depuis un salarié
            {prefilling && <Loader2 className="size-3.5 animate-spin text-brand-500" />}
          </label>
          <p className="mb-2 text-xs text-slate-500">
            Sélectionnez un salarié pour reprendre automatiquement les informations de son dossier.
          </p>
          <select
            value={prefillId}
            onChange={(e) => handlePrefillSelect(e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">— Choisir un salarié —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Dynamic fields */}
      <div className="space-y-4">
        {template.fields.map((field) => (
          <div key={field.name}>
            <label className={LABEL_CLASS}>
              {field.label}
              {field.required && !field.readOnly && <span className="ml-0.5 text-red-500">*</span>}
            </label>
            {field.readOnly ? (
              <input
                type="text"
                readOnly
                value={
                  !computedFields[field.name]
                    ? "—"
                    : field.type === "date"
                      ? formatFr(computedFields[field.name])
                      : `${computedFields[field.name]} jour${Number(computedFields[field.name]) > 1 ? "s" : ""}`
                }
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
              />
            ) : isEmployee && NAME_FIELDS.includes(field.name) ? (
              <input
                type="text"
                readOnly
                value={fields[field.name] ?? ""}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
              />
            ) : field.dynamicOptions ? (
              <select
                value={fields[field.name] ?? ""}
                onChange={(e) => handleField(field.name, e.target.value)}
                required={field.required}
                className={INPUT_CLASS}
              >
                <option value="">— Choisir —</option>
                {(dynamicData[field.dynamicOptions] ?? []).map((opt, i) => (
                  <option key={`${opt}-${i}`} value={opt}>{opt}</option>
                ))}
              </select>
            ) : field.options ? (
              <select
                value={fields[field.name] ?? ""}
                onChange={(e) => handleField(field.name, e.target.value)}
                required={field.required}
                className={INPUT_CLASS}
              >
                <option value="">— Choisir —</option>
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                value={fields[field.name] ?? ""}
                onChange={(e) => handleField(field.name, e.target.value)}
                required={field.required}
                min={field.type === "number" ? 0 : undefined}
                className={INPUT_CLASS}
              />
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : mode === "request" ? (
          <Send className="size-4" />
        ) : (
          <Download className="size-4" />
        )}
        {loading
          ? mode === "request" ? "Envoi en cours…" : "Génération en cours…"
          : mode === "request" ? "Envoyer la demande" : "Générer le PDF"
        }
      </button>
    </form>
  );
}
