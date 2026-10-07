"use client";

import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, TriangleAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { Table, Thead, Th, Tbody } from "@/components/ui/Table";
import type { ImportPreview } from "@/app/api/suivi/import/route";
import { commitSuiviImport } from "@/app/(dashboard)/conges/suivi-actions";

/**
 * Two-step import: the file is parsed server-side into a preview, and nothing
 * is written until that preview is confirmed. The same file is then re-sent
 * and re-parsed by the action — the preview is a display, never the payload.
 */
export function SuiviImporter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState<"parse" | "commit" | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function reset() {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(f: File) {
    setBusy("parse");
    setMsg(null);
    setPreview(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/suivi/import", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ type: "err", text: json.error ?? "Lecture impossible." });
        return;
      }
      setFile(f);
      setPreview(json as ImportPreview);
    } catch {
      setMsg({ type: "err", text: "Lecture impossible." });
    } finally {
      setBusy(null);
    }
  }

  async function handleCommit() {
    if (!file) return;
    setBusy("commit");
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await commitSuiviImport(fd);
    setBusy(null);
    if ("error" in res) {
      setMsg({ type: "err", text: res.error });
      return;
    }
    setMsg({
      type: "ok",
      text: `${res.created} salarié(s) créé(s), ${res.updated} mis à jour, ${res.linked} lié(s) à un compte.`,
    });
    reset();
  }

  return (
    <div className="space-y-5">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 px-6 py-8 text-center transition-colors hover:border-brand-500 hover:bg-brand-50/40">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {busy === "parse" ? (
          <Loader2 className="size-6 animate-spin text-brand-600" aria-hidden />
        ) : (
          <Upload className="size-6 text-slate-400" aria-hidden />
        )}
        <span className="text-sm font-medium text-slate-700">
          {busy === "parse" ? "Lecture du fichier…" : "Choisir le fichier « Salariés » (.csv)"}
        </span>
        <span className="text-xs text-slate-500">
          Export CSV de l&apos;onglet Salariés du classeur Suivi RH — 2 Mo maximum
        </span>
      </label>

      {msg && <FormMessage type={msg.type}>{msg.text}</FormMessage>}

      {preview && (
        <div className="space-y-4">
          {preview.errors.length > 0 && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              <ul className="list-inside list-disc space-y-1">
                {preview.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {preview.rows.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                <Chip tone="emerald">{preview.counts.create} à créer</Chip>
                <Chip tone="brand">{preview.counts.update} à mettre à jour</Chip>
                <Chip tone="slate">{preview.counts.linked} lié(s) à un compte</Chip>
                {preview.counts.warnings > 0 && (
                  <Chip tone="amber">{preview.counts.warnings} à vérifier</Chip>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto rounded-xl ring-1 ring-slate-900/[0.07]">
                <Table>
                  <Thead>
                    <Th>Salarié</Th>
                    <Th className="hidden md:table-cell">Poste</Th>
                    <Th className="hidden md:table-cell">Entrée</Th>
                    <Th>Solde</Th>
                    <Th>Action</Th>
                  </Thead>
                  <Tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.nomComplet}>
                        <td className="px-5 py-2.5">
                          <p className="font-medium text-slate-800">{r.nomComplet}</p>
                          {(r.warnings.length > 0 || r.linkNote) && (
                            <p className="mt-0.5 flex items-start gap-1 text-xs text-amber-700">
                              <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
                              <span>{[...r.warnings, r.linkNote].filter(Boolean).join(" · ")}</span>
                            </p>
                          )}
                          {r.linkedTo && (
                            <p className="mt-0.5 text-xs text-slate-500">
                              → compte « {r.linkedTo} »
                            </p>
                          )}
                        </td>
                        <td className="hidden px-5 py-2.5 text-slate-600 md:table-cell">
                          {r.poste ?? "—"}
                        </td>
                        <td className="hidden px-5 py-2.5 tabular-nums text-slate-600 md:table-cell">
                          {r.dateEntree ?? "—"}
                        </td>
                        <td className="px-5 py-2.5 tabular-nums text-slate-600">
                          {r.soldeCongesN ?? "—"}
                        </td>
                        <td className="px-5 py-2.5">
                          {r.action === "create" ? (
                            <Chip tone="emerald">Créer</Chip>
                          ) : (
                            <Chip tone="brand">Mettre à jour</Chip>
                          )}
                        </td>
                      </tr>
                    ))}
                  </Tbody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleCommit} loading={busy === "commit"}>
                  <FileSpreadsheet className="size-4" aria-hidden />
                  Confirmer l&apos;import
                </Button>
                <Button variant="secondary" onClick={reset} disabled={busy !== null}>
                  Annuler
                </Button>
                <p className="text-xs text-slate-500">
                  Aucune donnée n&apos;est écrite tant que vous n&apos;avez pas confirmé.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const TONES = {
  emerald: "bg-emerald-50 text-emerald-700",
  brand: "bg-brand-50 text-brand-700",
  amber: "bg-amber-50 text-amber-700",
  slate: "bg-slate-100 text-slate-600",
} as const;

function Chip({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
