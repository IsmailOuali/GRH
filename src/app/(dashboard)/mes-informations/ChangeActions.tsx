"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/control";
import { cancelProfileChange, reviewProfileChange } from "./actions";
import { showToast, toastResult } from "@/lib/toast";

/** The salarié withdraws a pending request. */
export function CancelChangeButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await cancelProfileChange(id);
      if ("error" in res) setError(res.error);
      else router.refresh();
      toastResult(res, "Demande annulée.");
    } catch {
      setError("Impossible de contacter le serveur.");
      showToast("err", "Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button size="sm" variant="ghost" loading={loading} onClick={cancel}>
        Annuler la demande
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/** The RH validates or refuses; a refusal is confirmed in a second step with its reason. */
export function ReviewChangeButtons({ id, disabledReason }: { id: string; disabledReason?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (disabledReason) return <p className="text-xs italic text-slate-500">{disabledReason}</p>;

  async function submit(decision: "APPROVED" | "REJECTED") {
    setLoading(decision);
    setError(null);
    try {
      const res = await reviewProfileChange(id, decision, decision === "REJECTED" ? note : undefined);
      if ("error" in res) setError(res.error);
      else router.refresh();
      toastResult(res, decision === "APPROVED" ? "Modification validée, fiche mise à jour." : "Modification refusée.");
    } catch {
      setError("Impossible de contacter le serveur.");
      showToast("err", "Impossible de contacter le serveur.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      {showReject ? (
        <>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
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
        </>
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="success"
            loading={loading === "APPROVED"}
            disabled={!!loading}
            onClick={() => submit("APPROVED")}
          >
            {loading !== "APPROVED" && <Check className="size-3.5" aria-hidden />}
            Valider et mettre à jour la fiche
          </Button>
          <Button size="sm" variant="danger" onClick={() => setShowReject(true)}>
            <X className="size-3.5" aria-hidden />
            Refuser
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
