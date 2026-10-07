"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { controlClass } from "@/components/ui/control";
import { deleteTrackedEmployee, setDateSortie } from "@/app/(dashboard)/conges/suivi-actions";

/**
 * Date de sortie is edited inline rather than behind a modal: it is the one
 * field managers change routinely, and a filled value tints the control so a
 * departure is visible while scanning the column.
 */
export function DateSortieInput({
  id,
  value,
  name,
}: {
  id: string;
  value: string | null;
  name: string;
}) {
  const [current, setCurrent] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function commit(next: string) {
    const previous = current;
    setCurrent(next);
    setSaving(true);
    setError(false);
    const res = await setDateSortie(id, next);
    setSaving(false);
    if ("error" in res) {
      setCurrent(previous);
      setError(true);
      window.alert(res.error);
    }
  }

  return (
    <span className="relative inline-flex items-center">
      <input
        type="date"
        value={current}
        aria-label={`Date de sortie de ${name}`}
        aria-invalid={error || undefined}
        disabled={saving}
        onChange={(e) => commit(e.target.value)}
        className={`${controlClass} w-[9.5rem] py-1.5 text-xs md:py-1.5 ${
          current ? "border-rose-300 text-rose-700" : ""
        }`}
      />
      {saving && (
        <Loader2 className="pointer-events-none absolute right-8 size-3.5 animate-spin text-slate-400" aria-hidden />
      )}
    </span>
  );
}

export function DeleteTrackedButton({ id, name }: { id: string; name: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (
      !window.confirm(
        `Retirer ${name} du suivi RH ?\nCette action supprime la fiche de suivi importée ; le compte utilisateur et les demandes de congé ne sont pas touchés.`,
      )
    ) {
      return;
    }
    setLoading(true);
    const res = await deleteTrackedEmployee(id);
    if ("error" in res) {
      setLoading(false);
      window.alert(res.error);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      title={`Retirer ${name} du suivi`}
      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      <span className="sr-only md:not-sr-only">Retirer</span>
    </button>
  );
}
