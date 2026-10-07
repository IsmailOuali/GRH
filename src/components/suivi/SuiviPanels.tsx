import { Users, CalendarOff, Clock, Timer, Plane, Activity, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, Thead, Th, Tbody } from "@/components/ui/Table";
import { SoldeChart } from "@/components/suivi/SoldeChart";
import { DateSortieInput, DeleteTrackedButton } from "@/components/suivi/SuiviRowActions";
import { TrackedEmployeeEditor } from "@/components/suivi/TrackedEmployeeEditor";
import {
  computeAlerts,
  formatNum,
  formatPct,
  initials,
  SEUIL_SOLDE_FAIBLE,
  type SuiviTotals,
} from "@/lib/suivi/compute";

/**
 * The at-a-glance layer: six headline figures. Single values are stat tiles,
 * not charts — a bar of one number says nothing a number does not.
 *
 * Every figure here is CUMULATIVE ("à date"), because the Salariés sheet has
 * no dated entries behind it. The caption says so rather than letting the
 * reader assume it is the current month.
 */
export function SuiviKpis({ totals, joursOuvres }: { totals: SuiviTotals; joursOuvres: number }) {
  const eleve = totals.tauxAbsenteisme > 0.05;
  const items = [
    { icon: Users, label: "Salariés suivis", value: String(totals.effectif), sub: totals.effectifTotal > totals.effectif ? `${totals.effectifTotal - totals.effectif} sorti(s)` : "effectif actif" },
    { icon: CalendarOff, label: "Jours d'absence", value: formatNum(totals.absences), sub: "cumul à date" },
    { icon: Clock, label: "Retards", value: String(totals.retardsNb), sub: `${formatNum(totals.retardsH)} h cumulées` },
    { icon: Timer, label: "Heures de retard", value: formatNum(totals.retardsH), sub: "cumul à date" },
    { icon: Plane, label: "Congés pris", value: formatNum(totals.congesPris), sub: `${formatNum(totals.soldeRestant)} j restants` },
    { icon: Activity, label: "Taux d'absentéisme", value: formatPct(totals.tauxAbsenteisme), sub: `base ${joursOuvres} j ouvrés`, danger: eleve },
  ];

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 md:mb-6 md:grid-cols-3 xl:grid-cols-6">
      {items.map((it) => (
        <Card key={it.label}>
          <CardBody className="p-4 md:p-4">
            <div className="flex items-center gap-2">
              <it.icon className={`size-4 shrink-0 ${it.danger ? "text-rose-500" : "text-slate-400"}`} aria-hidden />
              <p className="truncate text-xs font-medium text-slate-500">{it.label}</p>
            </div>
            <p className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${it.danger ? "text-rose-600" : "text-slate-900"}`}>
              {it.value}
            </p>
            <p className="mt-1 truncate text-xs text-slate-500">{it.sub}</p>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

/** Threshold breaches, criticals first. Each chip states the reason in words —
 *  the tint is a second cue, never the only one. */
export function SuiviAlerts({ totals }: { totals: SuiviTotals }) {
  const alerts = computeAlerts(totals);
  if (alerts.length === 0) return null;

  return (
    <div className="mb-5 flex flex-wrap gap-2 md:mb-6">
      {alerts.map((a, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ring-1 ring-inset ${
            a.level === "crit"
              ? "bg-rose-50 text-rose-700 ring-rose-200"
              : "bg-amber-50 text-amber-800 ring-amber-200"
          }`}
        >
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
          {a.text}
        </span>
      ))}
    </div>
  );
}

/** Per-salarié detail. Doubles as the table view that licences the chart's
 *  low-contrast light segment. */
export function SuiviTable({ totals }: { totals: SuiviTotals }) {
  if (totals.rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Users}
          title="Aucun salarié suivi"
          description="Importez le fichier « Salariés » depuis l'onglet Import pour alimenter le suivi."
        />
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <Thead>
          <Th>Salarié</Th>
          <Th className="hidden md:table-cell">Absences (j)</Th>
          <Th className="hidden md:table-cell">Retards</Th>
          <Th className="hidden lg:table-cell">Retards (h)</Th>
          <Th className="hidden md:table-cell">Congés pris</Th>
          <Th>Solde</Th>
          <Th className="hidden lg:table-cell">Date de sortie</Th>
          <Th className="w-10"><span className="sr-only">Actions</span></Th>
        </Thead>
        <Tbody>
          {totals.rows.map((r) => {
            const faible = r.solde !== null && r.solde < SEUIL_SOLDE_FAIBLE;
            return (
              <tr key={r.employee.id} className={r.parti ? "opacity-55" : undefined}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-[10px] font-bold text-brand-700">
                      {initials(r.employee.nomComplet)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">
                        {r.employee.nomComplet}
                        {r.parti && <span className="ml-1.5 text-xs font-normal text-slate-500">· sorti</span>}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {r.employee.poste ?? "—"}
                        {r.employee.userId && <span className="text-brand-600"> · compte lié</span>}
                      </p>
                    </div>
                  </div>
                </td>
                <td className={`hidden px-5 py-3 tabular-nums md:table-cell ${r.absences === 0 ? "text-slate-400" : "text-slate-700"}`}>{formatNum(r.absences)}</td>
                <td className={`hidden px-5 py-3 tabular-nums md:table-cell ${r.retardsNb === 0 ? "text-slate-400" : "text-slate-700"}`}>{r.retardsNb}</td>
                <td className={`hidden px-5 py-3 tabular-nums lg:table-cell ${r.retardsH === 0 ? "text-slate-400" : "text-slate-700"}`}>{formatNum(r.retardsH)}</td>
                <td className={`hidden px-5 py-3 tabular-nums md:table-cell ${r.congesPris === 0 ? "text-slate-400" : "text-slate-700"}`}>{formatNum(r.congesPris)}</td>
                <td className="px-5 py-3">
                  {r.solde === null ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <span className={`font-medium tabular-nums ${faible ? "text-rose-600" : "text-slate-800"}`}>
                      {formatNum(r.solde)} j
                      {faible && <span className="ml-1 text-xs font-normal">· faible</span>}
                    </span>
                  )}
                </td>
                <td className="hidden px-5 py-3 lg:table-cell">
                  <DateSortieInput id={r.employee.id} value={r.employee.dateSortie} name={r.employee.nomComplet} />
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <TrackedEmployeeEditor employee={r.employee} />
                    <DeleteTrackedButton id={r.employee.id} name={r.employee.nomComplet} />
                  </div>
                </td>
              </tr>
            );
          })}
        </Tbody>
      </Table>
    </Card>
  );
}

export function SuiviStats({ totals }: { totals: SuiviTotals }) {
  return (
    <Card>
      <CardHeader title="Solde de congés par salarié" icon={Plane} />
      <CardBody>
        <SoldeChart rows={totals.rows} />
      </CardBody>
    </Card>
  );
}
