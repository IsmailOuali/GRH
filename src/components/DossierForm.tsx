"use client";

import { useMemo, useState } from "react";
import { Loader2, Download, Save, X, Plus, AlertTriangle, Link2 as LinkIcon } from "lucide-react";
import {
  SECTIONS,
  SCALAR_FIELDS_BY_SECTION,
  PIECE_STATUT_OPTIONS,
  OUTIL_SUGGESTIONS,
  type DossierData,
  type DossierField,
  type DossierPiece,
} from "@/lib/dossiers/schema";
import { dataToColumns } from "@/lib/dossiers/serialize";
import { saveDossier } from "@/app/(dashboard)/admin/dossiers/actions";

const INPUT_CLASS =
  "w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/20";
const LABEL_CLASS = "mb-1 flex items-center gap-2 text-sm font-medium text-slate-700";

type Msg = { type: "ok" | "err"; text: string } | null;

/**
 * Stable serialization of the dossier in its CANONICAL persisted form.
 *
 * Reuses `dataToColumns` — the exact normalization `saveDossier` applies — so
 * the dirty check mirrors what a save would actually write. Edits that
 * normalize away (trailing whitespace, a blank outil, an empty pièce row)
 * correctly read as "no change" instead of arming the button for a no-op save.
 */
function dataSnapshot(data: DossierData): string {
  const cols = dataToColumns(data);
  return JSON.stringify(Object.keys(cols).sort().map((k) => [k, cols[k]]));
}

export function DossierForm({
  id,
  initialData,
  flagEmpties = false,
  employees = [],
  linkedUserId = null,
}: {
  id: string;
  initialData: DossierData;
  /** When true (dossier came from an upload), empty fields are flagged "non détecté". */
  flagEmpties?: boolean;
  /** Company accounts this dossier can be linked to. */
  employees?: { id: string; name: string; role: string }[];
  /** Currently linked account id, if any. */
  linkedUserId?: string | null;
}) {
  const [fields, setFields] = useState<Record<string, string>>(initialData.fields);
  const [outils, setOutils] = useState<string[]>(initialData.outilsAttribues);
  const [pieces, setPieces] = useState<DossierPiece[]>(initialData.pieces);
  const [linkedUser, setLinkedUser] = useState<string>(linkedUserId ?? "");
  const [outilDraft, setOutilDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  // Last-persisted state, so "Enregistrer" can stay disabled until something
  // actually changed. Tracked as two parts because the two save paths differ:
  // saveDossier writes the dossier AND the linked account, while the regenerate
  // route writes only the dossier — so a pending link change must survive it.
  const [savedData, setSavedData] = useState(() => dataSnapshot(initialData));
  const [savedLinkedUser, setSavedLinkedUser] = useState(linkedUserId ?? "");

  const ROLE_LABELS: Record<string, string> = { ADMIN: "Directeur", MANAGER: "Responsable", EMPLOYEE: "Salarié" };

  function current(): DossierData {
    return { fields, outilsAttribues: outils, pieces };
  }

  const currentData = useMemo(
    () => dataSnapshot({ fields, outilsAttribues: outils, pieces }),
    [fields, outils, pieces],
  );
  const dirty = currentData !== savedData || linkedUser !== savedLinkedUser;

  function setField(name: string, value: string) {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  function addOutil(value: string) {
    const v = value.trim();
    if (v && !outils.includes(v)) setOutils((prev) => [...prev, v]);
    setOutilDraft("");
  }

  function setPiece(idx: number, patch: Partial<DossierPiece>) {
    setPieces((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    // Snapshot what we're sending: re-baselining to *this* rather than to
    // whatever state exists when the request returns keeps edits made mid-flight
    // correctly marked as unsaved.
    const sent = current();
    const sentData = dataSnapshot(sent);
    const sentLinkedUser = linkedUser;

    const res = await saveDossier(id, sent, sentLinkedUser || null);
    if ("error" in res) {
      setMsg({ type: "err", text: res.error });
    } else {
      setSavedData(sentData);
      setSavedLinkedUser(sentLinkedUser);
      setMsg({ type: "ok", text: "Dossier enregistré." });
    }
    setSaving(false);
  }

  async function handleGenerate() {
    setGenerating(true);
    setMsg(null);
    const sent = current();
    const sentData = dataSnapshot(sent);
    try {
      const res = await fetch(`/api/dossiers/${id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sent),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setMsg({ type: "err", text: json.error ?? "Erreur lors de la génération." });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dossier-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      // The regenerate route persists the dossier columns too — but NOT the
      // linked account, so `savedLinkedUser` is deliberately left untouched.
      setSavedData(sentData);
      setMsg({ type: "ok", text: "PDF régénéré et enregistré." });
    } catch {
      setMsg({ type: "err", text: "Impossible de contacter le serveur." });
    } finally {
      setGenerating(false);
    }
  }

  function renderField(f: DossierField) {
    const value = fields[f.name] ?? "";
    const flagged = flagEmpties && !value.trim();
    const borderClass = flagged ? "border-amber-400 bg-amber-50/40" : "border-slate-300";

    return (
      <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
        <label className={LABEL_CLASS}>
          {f.label}
          {flagged && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-normal text-amber-700">
              <AlertTriangle className="size-3" /> non détecté
            </span>
          )}
        </label>
        {f.type === "select" ? (
          <select value={value} onChange={(e) => setField(f.name, e.target.value)} className={`${INPUT_CLASS} ${borderClass}`}>
            <option value="">— Choisir —</option>
            {(f.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : f.type === "textarea" ? (
          <textarea rows={2} value={value} onChange={(e) => setField(f.name, e.target.value)} className={`${INPUT_CLASS} ${borderClass}`} />
        ) : (
          <input
            type={f.type === "date" ? "date" : "text"}
            value={value}
            onChange={(e) => setField(f.name, e.target.value)}
            className={`${INPUT_CLASS} ${borderClass}`}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Linked employee account — feeds the employee's dashboard info card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
          <LinkIcon className="size-4 text-slate-400" />
          Employé lié
        </label>
        <p className="mb-2 text-xs text-slate-400">
          Rattachez ce dossier à un compte pour alimenter sa fiche d&apos;informations sur le tableau de bord.
        </p>
        <select
          value={linkedUser}
          onChange={(e) => setLinkedUser(e.target.value)}
          className={`${INPUT_CLASS} border-slate-300 sm:max-w-sm`}
        >
          <option value="">— Aucun compte lié —</option>
          {employees.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({ROLE_LABELS[u.role] ?? u.role})
            </option>
          ))}
        </select>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-medium text-slate-700">{section.title}</h2>
          </div>
          <div className="p-5">
            {section.id === "pieces-justificatives" ? (
              <PiecesEditor pieces={pieces} setPiece={setPiece} setPieces={setPieces} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {SCALAR_FIELDS_BY_SECTION[section.id].map(renderField)}
                {section.id === "coordonnees-acces-materiel" && (
                  <OutilsEditor
                    outils={outils}
                    draft={outilDraft}
                    setDraft={setOutilDraft}
                    add={addOutil}
                    remove={(o) => setOutils((prev) => prev.filter((x) => x !== o))}
                    flagged={flagEmpties && outils.length === 0}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      {msg && (
        <p className={`text-sm ${msg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>
      )}

      <div className="sticky bottom-4 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur">
        <button
          onClick={handleSave}
          disabled={!dirty || saving || generating}
          title={dirty ? undefined : "Aucune modification à enregistrer"}
          className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Enregistrer
        </button>
        <button
          onClick={handleGenerate}
          disabled={saving || generating}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {generating ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Régénérer le PDF
        </button>
      </div>
    </div>
  );
}

function OutilsEditor({
  outils, draft, setDraft, add, remove, flagged,
}: {
  outils: string[];
  draft: string;
  setDraft: (v: string) => void;
  add: (v: string) => void;
  remove: (v: string) => void;
  flagged: boolean;
}) {
  return (
    <div className="sm:col-span-2">
      <label className={LABEL_CLASS}>
        Outils attribués
        {flagged && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-normal text-amber-700">
            <AlertTriangle className="size-3" /> non détecté
          </span>
        )}
      </label>
      {outils.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {outils.map((o) => (
            <span key={o} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700">
              {o}
              <button type="button" onClick={() => remove(o)} className="text-brand-400 hover:text-brand-700">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(draft); } }}
          placeholder="Ajouter un outil…"
          className={`${INPUT_CLASS} border-slate-300`}
        />
        <button type="button" onClick={() => add(draft)} className="flex items-center gap-1 rounded-xl border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50">
          <Plus className="size-4" /> Ajouter
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {OUTIL_SUGGESTIONS.filter((s) => !outils.includes(s)).map((s) => (
          <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-500 hover:bg-slate-50">
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function PiecesEditor({
  pieces, setPiece, setPieces,
}: {
  pieces: DossierPiece[];
  setPiece: (idx: number, patch: Partial<DossierPiece>) => void;
  setPieces: React.Dispatch<React.SetStateAction<DossierPiece[]>>;
}) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
              <th className="px-3 py-2 font-medium">Document</th>
              <th className="px-3 py-2 font-medium">Statut</th>
              <th className="px-3 py-2 font-medium">Date de réception</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pieces.map((p, idx) => (
              <tr key={idx}>
                <td className="px-3 py-2">
                  <input
                    value={p.document}
                    onChange={(e) => setPiece(idx, { document: e.target.value })}
                    className={`${INPUT_CLASS} border-slate-300`}
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={p.statut}
                    onChange={(e) => setPiece(idx, { statut: e.target.value })}
                    className={`${INPUT_CLASS} border-slate-300`}
                  >
                    {PIECE_STATUT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="date"
                    value={p.dateReception}
                    onChange={(e) => setPiece(idx, { dateReception: e.target.value })}
                    className={`${INPUT_CLASS} border-slate-300`}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setPieces((prev) => prev.filter((_, i) => i !== idx))}
                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <X className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => setPieces((prev) => [...prev, { document: "", statut: "En attente", dateReception: "" }])}
        className="flex items-center gap-1 text-sm text-brand-600 hover:underline"
      >
        <Plus className="size-4" /> Ajouter une pièce
      </button>
    </div>
  );
}
