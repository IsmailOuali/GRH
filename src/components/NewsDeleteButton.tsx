"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteNews } from "@/app/(dashboard)/admin/actions";

export function NewsDeleteButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const fd = new FormData();
    fd.append("id", id);
    await deleteNews(fd);
    setLoading(false);
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
      title="Supprimer"
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Trash2 className="size-3.5" />
      )}
    </button>
  );
}
