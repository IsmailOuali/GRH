"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { TappableRow } from "@/components/TappableRow";
import { Table, Thead, Th, Tbody } from "@/components/ui/Table";
import { controlClass } from "@/components/ui/control";

export type AdvanceHistoryRow = {
  id: string;
  /** yyyy-MM, computed on the server so SSR and the browser always agree. */
  monthKey: string;
  /** dd/MM/yyyy, formatted on the server for the same reason. */
  dateLabel: string;
  /** Only set in the team view. */
  userName?: string;
  amount: number;
  status: string;
  repaymentMonth: string | null;
  reason: string | null;
  reviewNote: string | null;
};

export type MonthOption = { key: string; label: string };

const dh = (n: number) => `${n.toLocaleString("fr-FR")} DH`;

/**
 * Acomptes history for ONE month at a time. It opens on the current month and
 * the selector (or the arrows) walks back through the previous ones. Rows come
 * in newest-first from the server and keep that order.
 */
export function AdvanceHistory({
  rows,
  months,
  currentKey,
  showEmployee,
}: {
  rows: AdvanceHistoryRow[];
  /** Newest first. Always contains the current month, even when it is empty. */
  months: MonthOption[];
  currentKey: string;
  showEmployee: boolean;
}) {
  const [month, setMonth] = useState(currentKey);

  const index = months.findIndex((m) => m.key === month);
  const older = index >= 0 ? months[index + 1] : undefined;
  const newer = index > 0 ? months[index - 1] : undefined;

  const visible = rows.filter((r) => r.monthKey === month);
  const validated = visible.filter((r) => r.status === "APPROVED").reduce((s, r) => s + r.amount, 0);
  const label = months.find((m) => m.key === month)?.label ?? month;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => older && setMonth(older.key)}
            disabled={!older}
            aria-label="Mois précédent"
            className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Mois affiché"
            className={`${controlClass} min-w-44 py-1.5`}
          >
            {months.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
                {m.key === currentKey ? " (en cours)" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => newer && setMonth(newer.key)}
            disabled={!newer}
            aria-label="Mois suivant"
            className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
        <p className="text-xs tabular-nums text-slate-500" aria-live="polite">
          {visible.length} demande{visible.length > 1 ? "s" : ""} · {dh(validated)} validés
        </p>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Wallet} title="Aucune demande" description={`Aucune demande d'acompte en ${label.toLowerCase()}.`} />
      ) : (
        <Table>
          <Thead>
            {showEmployee && <Th>Salarié</Th>}
            <Th className={showEmployee ? "hidden md:table-cell" : undefined}>Date</Th>
            <Th>Montant</Th>
            <Th>Statut</Th>
            <Th className="w-8 md:hidden"><span className="sr-only">Détail</span></Th>
          </Thead>
          <Tbody>
            {visible.map((a) => (
              <TappableRow
                key={a.id}
                className="hover:bg-slate-50/70"
                detail={{
                  title: showEmployee ? (a.userName ?? "") : `Acompte — ${dh(a.amount)}`,
                  items: [
                    ...(showEmployee ? [{ label: "Salarié", value: a.userName ?? "" }] : []),
                    { label: "Date", value: a.dateLabel },
                    { label: "Montant", value: dh(a.amount) },
                    { label: "Remboursement souhaité", value: a.repaymentMonth ?? "" },
                    { label: "Motif", value: a.reason ?? "" },
                    { label: "Statut", value: <StatusBadge status={a.status} /> },
                    ...(a.reviewNote ? [{ label: "Note", value: a.reviewNote }] : []),
                  ],
                }}
              >
                {showEmployee && <td className="px-5 py-3.5 font-medium text-slate-800">{a.userName}</td>}
                <td className={`px-5 py-3.5 text-slate-600 ${showEmployee ? "hidden md:table-cell" : ""}`}>{a.dateLabel}</td>
                <td className="px-5 py-3.5 font-medium text-slate-800">{dh(a.amount)}</td>
                <td className="px-5 py-3.5"><StatusBadge status={a.status} /></td>
              </TappableRow>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  );
}
