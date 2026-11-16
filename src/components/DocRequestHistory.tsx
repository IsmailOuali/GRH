"use client";

import { Download, Stamp, HandHelping } from "lucide-react";
import { format } from "date-fns";
import { StatusBadge } from "./StatusBadge";
import { Table, Thead, Th, Tbody } from "./ui/Table";
import { LinkButton } from "./ui/Button";
import { TEMPLATES_MAP } from "@/lib/documents/templates.config";
import { legalisationState } from "@/lib/documents/legalisation";

type DocRequest = {
  id: string;
  templateId: string;
  status: string;
  reviewNote: string | null;
  createdAt: Date;
  pdfPath: string | null;
  legalise: boolean;
  legaliseDelivery: string | null;
  legaliseAt: Date | null;
  legaliseNote: string | null;
  /** Whether a scan exists — the stored filename itself is never sent to the client. */
  hasLegaliseFile: boolean;
};

export function DocRequestHistory({ requests }: { requests: DocRequest[] }) {
  if (requests.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-slate-500">
        Aucune demande pour le moment.
      </p>
    );
  }

  return (
    <Table>
        <Thead>
            <Th>Document</Th>
            <Th className="hidden md:table-cell">Date</Th>
            <Th>Statut</Th>
            <Th>PDF</Th>
        </Thead>
        <Tbody>
          {requests.map((r) => {
            const label = TEMPLATES_MAP[r.templateId]?.label ?? r.templateId;
            const legal = legalisationState(r);
            const approved = r.status === "APPROVED" && r.pdfPath;
            return (
              <tr key={r.id} className="transition-colors duration-100 hover:bg-slate-50/70">
                <td className="px-5 py-4 font-medium text-slate-800">
                  {label}
                  {r.legalise && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800 ring-1 ring-inset ring-sky-200">
                      <Stamp className="size-3" aria-hidden />
                      Légalisée
                    </span>
                  )}
                </td>
                <td className="hidden px-5 py-4 text-slate-600 md:table-cell">
                  {format(new Date(r.createdAt), "dd/MM/yyyy")}
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge status={r.status} />
                    {legal === "EN_COURS" && (
                      <span className="text-xs text-amber-700">Légalisation en cours</span>
                    )}
                    {legal === "MAIN_PROPRE" && r.legaliseAt && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                        <HandHelping className="size-3" aria-hidden />
                        Légalisée — à retirer auprès des RH ({format(new Date(r.legaliseAt), "dd/MM/yyyy")})
                      </span>
                    )}
                    {r.reviewNote && (
                      <span className="text-xs italic text-slate-500">{r.reviewNote}</span>
                    )}
                    {r.legaliseNote && (
                      <span className="text-xs italic text-slate-500">{r.legaliseNote}</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4">
                  {approved ? (
                    <div className="flex flex-col items-start gap-2">
                      {legal === "SCAN" && r.hasLegaliseFile && (
                        <LinkButton
                          href={`/api/documents/download/${r.id}?version=legalisee`}
                          aria-label={`Télécharger ${label} (version légalisée)`}
                        >
                          <Download className="size-3.5" aria-hidden />
                          Version légalisée
                        </LinkButton>
                      )}
                      <LinkButton
                        href={`/api/documents/download/${r.id}`}
                        aria-label={`Télécharger ${label}${r.legalise ? " (version non légalisée)" : ""}`}
                      >
                        <Download className="size-3.5" aria-hidden />
                        {r.legalise ? "Version simple (non légalisée)" : "Télécharger"}
                      </LinkButton>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </Tbody>
    </Table>
  );
}
