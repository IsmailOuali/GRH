"use client";

import { useState } from "react";
import { Loader2, Check, X } from "lucide-react";
import { reviewAdvance } from "./advance-actions";

export function AdvanceButtons({ id }: { id: string }) {
  const [loading, setLoading] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [showReject, setShowReject] = useState(false);

  async function submit(decision: "APPROVED" | "REJECTED") {
    setLoading(decision);
    await reviewAdvance(id, decision, decision === "REJECTED" ? rejectNote || undefined : undefined);
    setLoading(null);
  }

  if (showReject) {
    return (
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder="Motif (optionnel)"
          className="rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
        />
        <div className="flex gap-2">
          <button
            onClick={() => submit("REJECTED")}
            disabled={!!loading}
            className="flex items-center gap-1 rounded-lg bg-red-600 px-3.5 py-2 text-xs md:px-3 md:py-1.5 text-white hover:bg-red-700 disabled:opacity-60"
          >
            {loading === "REJECTED" ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
            Confirmer
          </button>
          <button onClick={() => setShowReject(false)} className="text-xs text-slate-500 hover:underline">
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => submit("APPROVED")}
        disabled={!!loading}
        className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs md:px-3 md:py-1.5 text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading === "APPROVED" ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
        Valider
      </button>
      <button
        onClick={() => setShowReject(true)}
        className="flex items-center gap-1 rounded-lg border border-red-300 px-3.5 py-2 text-xs md:px-3 md:py-1.5 text-red-600 hover:bg-red-50"
      >
        <X className="size-3" />
        Refuser
      </button>
    </div>
  );
}
