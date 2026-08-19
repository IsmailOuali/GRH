"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteRemoteDay } from "@/app/(dashboard)/teletravail/actions";

export function RemoteDayDeleteButton({
  id,
  name,
  date,
}: {
  id: string;
  name: string;
  /** Already formatted dd/mm/yyyy — this button only shows it back. */
  date: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Annuler le télétravail de ${name} le ${date} ?`)) return;
    setLoading(true);
    const res = await deleteRemoteDay(id);
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
      title="Annuler ce jour de télétravail"
      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      Annuler
    </button>
  );
}
