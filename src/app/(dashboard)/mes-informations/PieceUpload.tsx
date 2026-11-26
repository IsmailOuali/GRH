"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { showToast } from "@/lib/toast";

const MAX_BYTES = 15 * 1024 * 1024; // keep in sync with the API route

/** Upload button for one pièce the RH is waiting for. */
export function PieceUpload({ piece }: { piece: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("Fichier trop volumineux (15 Mo max).");
      showToast("err", "Fichier trop volumineux (15 Mo max).");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("piece", piece);
      body.append("file", file);
      const res = await fetch("/api/mes-informations/pieces", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Échec de l'envoi.");
        showToast("err", json.error ?? "Échec de l'envoi.");
        return;
      }
      showToast("ok", "Pièce déposée. Les RH sont prévenus.");
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
      showToast("err", "Impossible de contacter le serveur.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        onChange={handleFile}
        className="sr-only"
        aria-label={`Choisir le fichier pour : ${piece}`}
      />
      <Button type="button" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
        <Upload className="size-3.5" aria-hidden />
        Déposer
      </Button>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
