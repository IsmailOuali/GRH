"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage } from "@/components/ui/Field";
import { controlClass } from "@/components/ui/control";
import { Table, Thead, Th, Tbody } from "@/components/ui/Table";
import { useFeedback } from "@/lib/toast";

type BulkResult = {
  total: number;
  assigned: { page: number; userName: string; matricule: string | null; mois: string; matchedBy: string | null }[];
  unassigned: { page: number; reason: string }[];
  duplicates: { page: number; userName: string; mois: string; reason: string }[];
};

/** An analysed file waiting for the admin's confirmation. */
type Preview = { result: BulkResult & { token: string }; body: FormData; fileUrl: string };

type Row = {
  page: number;
  employee: string;
  matricule?: string | null;
  mois: string;
  status: "ok" | "unassigned" | "duplicate";
  detail?: string;
};

const STATUS_LABEL: Record<"preview" | "done", Record<Row["status"], string>> = {
  preview: { ok: "À envoyer", unassigned: "Non assigné", duplicate: "Ignoré" },
  done: { ok: "Envoyé", unassigned: "Non assigné", duplicate: "Ignoré" },
};

const STATUS_CLASS: Record<Row["status"], string> = {
  ok: "bg-emerald-100 text-emerald-800",
  unassigned: "bg-red-100 text-red-800",
  duplicate: "bg-amber-100 text-amber-800",
};

function toRows(r: BulkResult): Row[] {
  return [
    ...r.assigned.map((a): Row => ({
      page: a.page,
      employee: a.userName,
      matricule: a.matricule,
      mois: a.mois,
      status: "ok",
      detail: a.matchedBy ? `reconnu par ${a.matchedBy}` : undefined,
    })),
    ...r.duplicates.map((d): Row => ({
      page: d.page,
      employee: d.userName,
      mois: d.mois,
      status: "duplicate",
      detail: d.reason,
    })),
    ...r.unassigned.map((u): Row => ({
      page: u.page,
      employee: "—",
      mois: "—",
      status: "unassigned",
      detail: u.reason,
    })),
  ].sort((a, b) => a.page - b.page);
}

function counts(r: BulkResult, okLabel: string): string {
  const parts = [`${r.assigned.length} ${okLabel} sur ${r.total} page(s)`];
  if (r.duplicates.length) parts.push(`${r.duplicates.length} ignoré(s)`);
  if (r.unassigned.length) parts.push(`${r.unassigned.length} non assigné(s)`);
  return parts.join(" · ") + ".";
}

export function BulkUploadPayslipForm() {
  const router = useRouter();
  const [loading, setLoading] = useState<"preview" | "confirm" | null>(null);
  const [msg, setMsg] = useFeedback();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // The preview sits below the form: bring it into view, mostly for phones.
  // Its blob URL (for "Voir la page") is released when the preview goes away.
  useEffect(() => {
    if (!preview) return;
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    return () => URL.revokeObjectURL(preview.fileUrl);
  }, [preview]);

  async function send(body: FormData) {
    const res = await fetch("/api/paie/bulk", { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  async function handleAnalyse(e: React.FormEvent) {
    e.preventDefault();
    const body = new FormData(formRef.current!); // read before the fields are disabled
    setLoading("preview");
    setMsg(null);
    setPreview(null);
    setResult(null);

    try {
      const { res, data } = await send(body);
      if (!res.ok) {
        setMsg({ type: "err", text: data.error ?? "Erreur lors de l'analyse du fichier." });
        return;
      }
      const file = body.get("file") as File;
      setPreview({ result: data, body, fileUrl: URL.createObjectURL(file) });
    } catch {
      setMsg({ type: "err", text: "Erreur réseau. Réessayez." });
    } finally {
      setLoading(null);
    }
  }

  async function handleConfirm() {
    if (!preview || loading) return;
    const body = new FormData();
    preview.body.forEach((value, key) => body.append(key, value));
    body.set("mode", "confirm");
    body.set("token", preview.result.token);
    setLoading("confirm");
    setMsg(null);

    try {
      const { res, data } = await send(body);
      if (!res.ok) {
        setMsg({ type: "err", text: data.error ?? "Erreur lors de l'enregistrement." });
        if (res.status === 409) setPreview(null); // out of date: analyse again
        return;
      }
      const r = data as BulkResult;
      setPreview(null);
      setResult(r);
      setMsg({
        type: r.assigned.length < preview.result.assigned.length ? "err" : "ok",
        text: counts(r, "bulletin(s) envoyé(s)"),
      });
      formRef.current?.reset();
      router.refresh(); // reload "Tous les bulletins"
    } catch {
      setMsg({ type: "err", text: "Erreur réseau. Vérifiez « Tous les bulletins » avant de réessayer." });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  function cancel() {
    setPreview(null);
    setMsg(null);
    formRef.current?.reset();
  }

  const shown = preview?.result ?? result;
  const rows = shown ? toRows(shown) : [];
  const labels = STATUS_LABEL[preview ? "preview" : "done"];

  return (
    <Card>
      <CardHeader icon={Layers} title="Upload groupé" />
      <CardBody>
        <p className="mb-4 max-w-xl text-sm text-slate-600">
          Envoyez un seul PDF contenant tous les bulletins (1 page = 1 salarié). Chaque page est rattachée
          automatiquement à son salarié par matricule, puis par nom complet. Vous voyez un aperçu avant
          tout envoi.
        </p>
        <form
          ref={formRef}
          onSubmit={handleAnalyse}
          // Another file or month: the preview on screen no longer applies.
          onChange={() => {
            setPreview(null);
            setResult(null);
            setMsg(null);
          }}
          className="max-w-md"
        >
          <fieldset disabled={loading !== null} className="space-y-4">
            <Field label="Fichier PDF" hint="Tous les bulletins dans un seul PDF (30 Mo maximum)." required>
              {(props) => (
                <input
                  {...props}
                  name="file"
                  type="file"
                  accept="application/pdf"
                  required
                  className={`${controlClass} file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-brand-700`}
                />
              )}
            </Field>

            <Field
              label="Mois (optionnel)"
              hint="Laissez vide pour lire le mois sur chaque page (« Période : Février 2025 »). Format : « Juin 2025 »."
            >
              {(props) => <input {...props} name="month" placeholder="Juin 2025" className={controlClass} />}
            </Field>

            {msg?.type === "err" && <FormMessage type="err">{msg.text}</FormMessage>}

            {!preview && (
              <Button type="submit" loading={loading === "preview"}>
                {loading === "preview" ? "Analyse en cours…" : "Voir l'aperçu"}
              </Button>
            )}
          </fieldset>
        </form>

        {shown && (
          <div ref={previewRef} className="mt-6 -mx-5 scroll-mt-20 border-t border-slate-100">
            {preview && (
              <div className="px-5 py-4">
                <h3 className="text-sm font-semibold text-slate-900">Aperçu avant envoi</h3>
                <p className="mt-1 text-sm text-slate-600">{counts(preview.result, "bulletin(s) à envoyer")}</p>
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Rien n&apos;est encore enregistré ni envoyé. Vérifiez que chaque page correspond au bon
                  salarié, puis confirmez.
                </p>
              </div>
            )}

            <Table>
              <Thead>
                <Th className="px-3 sm:px-5">Page</Th>
                <Th className="px-3 sm:px-5">Employé</Th>
                <Th className="px-3 sm:px-5">Mois</Th>
                <Th className="px-3 sm:px-5">Statut</Th>
              </Thead>
              <Tbody>
                {rows.map((r) => (
                  <tr key={r.page}>
                    <td className="px-3 py-3 tabular-nums text-slate-600 sm:px-5">
                      {r.page}
                      {preview && (
                        <a
                          href={`${preview.fileUrl}#page=${r.page}`}
                          target="_blank"
                          rel="noopener"
                          aria-label={`Voir la page ${r.page}`}
                          className="mt-1 block text-xs font-medium text-brand-700 underline"
                        >
                          Voir
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-800 sm:px-5">
                      {r.employee}
                      {r.matricule && (
                        <span className="block whitespace-nowrap text-xs font-normal text-slate-500">{r.matricule}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600 sm:px-5">{r.mois}</td>
                    <td className="px-3 py-3 sm:px-5">
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[r.status]}`}>
                        {labels[r.status]}
                      </span>
                      {r.detail && <p className="mt-1 text-xs text-slate-500">{r.detail}</p>}
                    </td>
                  </tr>
                ))}
              </Tbody>
            </Table>

            {preview && (
              <div className="flex flex-col gap-2 border-t border-slate-100 px-5 pt-4 sm:flex-row">
                <Button
                  type="button"
                  onClick={handleConfirm}
                  loading={loading === "confirm"}
                  disabled={preview.result.assigned.length === 0}
                >
                  {preview.result.assigned.length === 0
                    ? "Aucun bulletin à envoyer"
                    : `Confirmer et envoyer (${preview.result.assigned.length})`}
                </Button>
                <Button type="button" variant="secondary" onClick={cancel} disabled={loading !== null}>
                  Annuler
                </Button>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
