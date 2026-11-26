import { format } from "date-fns";
import { History } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/Card";
import { Table, Thead, Th, Tbody } from "@/components/ui/Table";
import { MOVEMENT_LABELS, type MovementKind } from "@/lib/leave-ledger";

export type MovementRow = {
  id: string;
  delta: number;
  balanceAfter: number;
  kind: string;
  note: string;
  createdAt: Date;
};

const days = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const signed = (n: number) => `${n > 0 ? "+" : "−"}${days(Math.abs(n))}`;

/** The salarié's own CP solde, movement by movement, newest first. */
export function LeaveBalanceHistory({ balance, movements }: { balance: number; movements: MovementRow[] }) {
  // The opening line is a starting point, not days earned or spent.
  const real = movements.filter((m) => m.kind !== "OPENING");
  const added = real.reduce((sum, m) => sum + Math.max(0, m.delta), 0);
  const deducted = real.reduce((sum, m) => sum + Math.min(0, m.delta), 0);

  const stats = [
    { label: "Solde actuel", value: `${days(balance)} j`, tone: "text-brand-700" },
    { label: "Jours ajoutés", value: added ? `${signed(added)} j` : "0 j", tone: "text-emerald-700" },
    { label: "Jours déduits", value: deducted ? `${signed(deducted)} j` : "0 j", tone: "text-rose-700" },
  ];

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-900/[0.07]">
            <dt className="text-xs font-medium text-slate-500">{s.label}</dt>
            <dd className={cn("mt-1 text-xl font-bold tabular-nums", s.tone)}>{s.value}</dd>
          </div>
        ))}
      </dl>

      <Card>
        {movements.length === 0 ? (
          <EmptyState
            icon={History}
            title="Aucun mouvement"
            description="Les ajouts et déductions de votre solde apparaîtront ici."
          />
        ) : (
          <Table>
            <Thead>
              <Th className="hidden md:table-cell">Date</Th>
              <Th>Opération</Th>
              <Th>Jours</Th>
              <Th>Solde</Th>
            </Thead>
            <Tbody>
              {movements.map((m) => {
                const date = format(m.createdAt, "dd/MM/yyyy");
                return (
                  <tr key={m.id}>
                    <td className="hidden px-5 py-3.5 tabular-nums text-slate-600 md:table-cell">{date}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-800">
                        {MOVEMENT_LABELS[m.kind as MovementKind] ?? m.kind}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{m.note}</p>
                      <p className="mt-0.5 text-xs tabular-nums text-slate-400 md:hidden">{date}</p>
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-5 py-3.5 font-semibold tabular-nums",
                        m.delta > 0 ? "text-emerald-700" : "text-rose-700",
                      )}
                    >
                      {signed(m.delta)}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-slate-800">{days(m.balanceAfter)}</td>
                  </tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
