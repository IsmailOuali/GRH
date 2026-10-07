"use client";

import { useState } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { reviewRemoteRequest } from "@/app/(dashboard)/teletravail/actions";

/**
 * Approve / refuse one télétravail request as a whole.
 *
 * Refusing warns that the days are removed rather than kept as a rejected
 * record — @@unique([userId, date]) means a retained row would block the
 * employee from ever asking for that date again.
 */
export function RemoteRequestButtons({
  requestId,
  name,
  days,
}: {
  requestId: string;
  name: string;
  days: number;
}) {
  const [pending, setPending] = useState<"APPROVED" | "REJECTED" | null>(null);

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (
      decision === "REJECTED" &&
      !window.confirm(
        `Refuser la demande de télétravail de ${name} (${days} jour${days > 1 ? "s" : ""}) ?\nLes jours demandés seront supprimés et ${name} sera notifié(e).`,
      )
    ) {
      return;
    }
    setPending(decision);
    const res = await reviewRemoteRequest(requestId, decision);
    if ("error" in res) {
      setPending(null);
      window.alert(res.error);
    }
    // On success the list revalidates and the row disappears.
  }

  const busy = pending !== null;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => decide("APPROVED")}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending === "APPROVED" ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Check className="size-3.5" aria-hidden />
        )}
        Valider
      </button>
      <button
        onClick={() => decide("REJECTED")}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
      >
        {pending === "REJECTED" ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <X className="size-3.5" aria-hidden />
        )}
        Refuser
      </button>
    </div>
  );
}
