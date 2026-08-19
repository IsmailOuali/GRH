"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/control";
import { reviewLeave } from "@/app/(dashboard)/conges/actions";

export function ValidationButtons({ id }: { id: string }) {
  const [loading, setLoading] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [showReject, setShowReject] = useState(false);

  async function submit(decision: "APPROVED" | "REJECTED") {
    setLoading(decision);
    const fd = new FormData();
    fd.append("id", id);
    fd.append("decision", decision);
    if (decision === "REJECTED" && rejectNote) fd.append("reviewNote", rejectNote);
    await reviewLeave(fd);
    setLoading(null);
  }

  // Refus en deux temps : le motif est saisi avant que le refus soit confirmé,
  // ce qui évite un rejet irréversible d'un seul tap.
  if (showReject) {
    return (
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder="Motif (optionnel)"
          aria-label="Motif du refus"
          autoFocus
          className={`${controlClass} py-2 text-xs`}
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="destructive"
            loading={loading === "REJECTED"}
            disabled={!!loading}
            onClick={() => submit("REJECTED")}
          >
            {loading !== "REJECTED" && <X className="size-3.5" aria-hidden />}
            Confirmer le refus
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowReject(false)}>
            Annuler
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="success"
        loading={loading === "APPROVED"}
        disabled={!!loading}
        onClick={() => submit("APPROVED")}
      >
        {loading !== "APPROVED" && <Check className="size-3.5" aria-hidden />}
        Valider
      </Button>
      <Button size="sm" variant="danger" onClick={() => setShowReject(true)}>
        <X className="size-3.5" aria-hidden />
        Refuser
      </Button>
    </div>
  );
}
