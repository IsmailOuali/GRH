"use client";

import { useState, useTransition } from "react";
import { Check, X, ChevronDown, ChevronUp, Inbox } from "lucide-react";
import { format } from "date-fns";
import { EmptyState } from "./EmptyState";
import { TEMPLATES_MAP } from "@/lib/documents/templates.config";
import { reviewDocumentRequest } from "@/app/(dashboard)/documents/actions";

type DocRequest = {
  id: string;
  templateId: string;
  fieldsJson: string;
  status: string;
  createdAt: Date;
  user: { name: string };
};

function RequestRow({ r }: { r: DocRequest }) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const fields = JSON.parse(r.fieldsJson) as Record<string, string>;
  const template = TEMPLATES_MAP[r.templateId];

  if (done) return null;

  function handle(decision: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      await reviewDocumentRequest(r.id, decision, note || undefined);
      setDone(true);
    });
  }

  return (
    // Rows live inside the page's Card, so they are dividers rather than
    // nested cards — one elevation level per surface.
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-800">{r.user.name}</p>
          <p className="text-sm text-slate-500">
            {template?.label ?? r.templateId} ·{" "}
            {format(new Date(r.createdAt), "dd/MM/yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Réduire les détails" : "Voir les détails"}
            aria-expanded={expanded}
            className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 md:size-9"
          >
            {expanded ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
          </button>
          <button
            disabled={pending}
            onClick={() => handle("REJECTED")}
            aria-label="Refuser la demande"
            className="grid size-10 place-items-center rounded-xl border border-red-200 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 md:size-9"
          >
            <X className="size-4" aria-hidden />
          </button>
          <button
            disabled={pending}
            onClick={() => handle("APPROVED")}
            aria-label="Approuver la demande"
            className="grid size-10 place-items-center rounded-xl bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 md:size-9"
          >
            <Check className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {template?.fields.map((f) => (
              <div key={f.name}>
                <p className="text-xs text-slate-500">{f.label}</p>
                <p className="font-medium text-slate-800">{fields[f.name] || "—"}</p>
              </div>
            ))}
          </div>
          <input
            type="text"
            placeholder="Note (optionnel)"
            aria-label="Note jointe à la décision"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/20"
          />
        </div>
      )}
    </div>
  );
}

export function DocRequestQueue({ requests }: { requests: DocRequest[] }) {
  if (requests.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Tout est à jour"
        description="Aucune demande de document en attente."
      />
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {requests.map((r) => (
        <RequestRow key={r.id} r={r} />
      ))}
    </div>
  );
}
