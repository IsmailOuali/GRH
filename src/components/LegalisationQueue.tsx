"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Download, HandHelping, Stamp, Upload } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { Button, LinkButton } from "./ui/Button";
import { TEMPLATES_MAP } from "@/lib/documents/templates.config";
import { markLegalisationDelivered } from "@/app/(dashboard)/documents/actions";
import { showToast, toastResult } from "@/lib/toast";

type LegalisationItem = {
  id: string;
  templateId: string;
  reviewedAt: Date | null;
  createdAt: Date;
  legaliseReason: string | null;
  user: { name: string };
};

function Row({ r }: { r: LegalisationItem }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  const label = TEMPLATES_MAP[r.templateId]?.label ?? r.templateId;
  const busy = uploading || pending;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      if (note.trim()) body.append("note", note.trim());
      const res = await fetch(`/api/documents/${r.id}/legalise`, { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Échec de l'import.");
        showToast("err", json.error ?? "Échec de l'import.");
        return;
      }
      showToast("ok", "Copie légalisée publiée.");
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
      showToast("err", "Impossible de contacter le serveur.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleDelivered() {
    setError(null);
    startTransition(async () => {
      const res = await markLegalisationDelivered(r.id, note || undefined);
      if (res.error) setError(res.error);
      else router.refresh();
      toastResult(res, "Remise en main propre enregistrée.");
    });
  }

  return (
    <div className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-800">{r.user.name}</p>
          <p className="text-sm text-slate-500">
            {label} · validée le {format(new Date(r.reviewedAt ?? r.createdAt), "dd/MM/yyyy")}
          </p>
          {r.legaliseReason && (
            <p className="mt-1 text-xs italic text-slate-500">Motif : {r.legaliseReason}</p>
          )}
        </div>
        {/* The plain PDF is what gets printed, signed and taken to the commune. */}
        <LinkButton href={`/api/documents/download/${r.id}`} aria-label={`Télécharger ${label} à imprimer`}>
          <Download className="size-3.5" aria-hidden />
          PDF à imprimer
        </LinkButton>
      </div>

      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
        placeholder="Note pour le salarié (optionnel)"
        aria-label="Note pour le salarié"
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/20"
      />

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          onChange={handleFile}
          className="sr-only"
          id={`scan-${r.id}`}
          aria-label={`Scan de la version légalisée pour ${r.user.name}`}
        />
        <Button
          type="button"
          size="sm"
          loading={uploading}
          disabled={pending}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-3.5" aria-hidden />
          Importer le scan légalisé
        </Button>
        <Button type="button" size="sm" variant="secondary" loading={pending} disabled={busy} onClick={handleDelivered}>
          <HandHelping className="size-3.5" aria-hidden />
          Remis en main propre
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function LegalisationQueue({ requests }: { requests: LegalisationItem[] }) {
  if (requests.length === 0) {
    return (
      <EmptyState
        icon={Stamp}
        title="Aucune légalisation en cours"
        description="Les attestations validées avec une version légalisée apparaîtront ici."
      />
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {requests.map((r) => (
        <Row key={r.id} r={r} />
      ))}
    </div>
  );
}
