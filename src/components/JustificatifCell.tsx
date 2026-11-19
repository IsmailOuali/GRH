"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Paperclip, Upload } from "lucide-react";
import { Button, LinkButton } from "./ui/Button";
import { JUSTIFICATIF_MAX_BYTES, type JustificatifState } from "@/lib/leave-justificatif";

/**
 * Justificatif column of a leave request.
 *  - `canUpload` (the employee on their own request): upload / replace button.
 *  - everyone: the download link once a file exists, or an "attendu" marker.
 */
export function JustificatifCell({
  id,
  state,
  canUpload,
}: {
  id: string;
  state: JustificatifState;
  canUpload: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state === "NONE") return <span className="text-xs text-slate-500">—</span>;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > JUSTIFICATIF_MAX_BYTES) {
      setError("Fichier trop volumineux (15 Mo max).");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/leaves/${id}/justificatif`, { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Échec de l'envoi.");
        return;
      }
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      {state === "PROVIDED" ? (
        <LinkButton href={`/api/leaves/${id}/justificatif`} aria-label="Télécharger le justificatif">
          <Download className="size-3.5" aria-hidden />
          Justificatif
        </LinkButton>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
          <Paperclip className="size-3" aria-hidden />
          Justificatif attendu
        </span>
      )}

      {canUpload && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={handleFile}
            className="sr-only"
            aria-label="Choisir le justificatif"
          />
          <Button
            type="button"
            size="sm"
            variant={state === "PROVIDED" ? "secondary" : "primary"}
            loading={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-3.5" aria-hidden />
            {state === "PROVIDED" ? "Remplacer" : "Déposer le justificatif"}
          </Button>
        </>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
