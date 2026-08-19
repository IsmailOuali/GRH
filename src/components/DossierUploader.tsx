"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, FilePlus2 } from "lucide-react";
import { createBlankDossier } from "@/app/(dashboard)/admin/dossiers/actions";

const MAX_BYTES = 5 * 1024 * 1024;

export function DossierUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (file.type !== "application/pdf") {
      setError("Seuls les fichiers PDF sont acceptés.");
      return;
    }
    if (file.size === 0 || file.size > MAX_BYTES) {
      setError("Le fichier ne doit pas dépasser 5 Mo.");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/dossiers/upload", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !json.id) {
        setError(json.error ?? "Échec de l'import.");
        return;
      }
      router.push(`/admin/dossiers/${json.id}`);
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setUploading(false);
    }
  }

  async function handleCreate() {
    setError(null);
    setCreating(true);
    const res = await createBlankDossier();
    if ("id" in res && res.id) {
      router.push(`/admin/dossiers/${res.id}`);
    } else {
      setError("error" in res ? res.error : "Erreur.");
      setCreating(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading || creating}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Importer un dossier
        </button>
        <button
          onClick={handleCreate}
          disabled={uploading || creating}
          className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {creating ? <Loader2 className="size-4 animate-spin" /> : <FilePlus2 className="size-4" />}
          Nouveau dossier
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>
      {uploading && <p className="text-sm text-slate-500">Extraction des données du PDF en cours…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
