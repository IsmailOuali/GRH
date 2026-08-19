"use client";

import { Download } from "lucide-react";
import { format } from "date-fns";
import { StatusBadge } from "./StatusBadge";
import { Table, Thead, Th, Tbody } from "./ui/Table";
import { LinkButton } from "./ui/Button";
import { TEMPLATES_MAP } from "@/lib/documents/templates.config";

type DocRequest = {
  id: string;
  templateId: string;
  status: string;
  reviewNote: string | null;
  createdAt: Date;
  pdfPath: string | null;
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
          {requests.map((r) => (
            <tr key={r.id} className="transition-colors duration-100 hover:bg-slate-50/70">
              <td className="px-5 py-4 font-medium text-slate-800">
                {TEMPLATES_MAP[r.templateId]?.label ?? r.templateId}
              </td>
              <td className="hidden px-5 py-4 text-slate-600 md:table-cell">
                {format(new Date(r.createdAt), "dd/MM/yyyy")}
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-col items-start gap-1">
                  <StatusBadge status={r.status} />
                  {r.reviewNote && (
                    <span className="text-xs italic text-slate-500">{r.reviewNote}</span>
                  )}
                </div>
              </td>
              <td className="px-5 py-4">
                {r.status === "APPROVED" && r.pdfPath ? (
                  <LinkButton
                    href={`/api/documents/download/${r.id}`}
                    aria-label={`Télécharger ${TEMPLATES_MAP[r.templateId]?.label ?? r.templateId}`}
                  >
                    <Download className="size-3.5" aria-hidden />
                    Télécharger
                  </LinkButton>
                ) : (
                  <span className="text-xs text-slate-500">—</span>
                )}
              </td>
            </tr>
          ))}
        </Tbody>
    </Table>
  );
}
