"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteDossier } from "@/app/(dashboard)/admin/dossiers/actions";

export function DossierDeleteButton({ id, name }: { id: string; name: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Supprimer définitivement le dossier de ${name} ? Cette action est irréversible.`)) {
      return;
    }
    setLoading(true);
    const res = await deleteDossier(id);
    if ("error" in res) {
      setLoading(false);
      window.alert(res.error);
    }
    // On success the list revalidates and the row disappears.
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      title="Supprimer le dossier"
      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      Supprimer
    </button>
  );
}
