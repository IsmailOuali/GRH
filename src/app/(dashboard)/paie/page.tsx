import { redirect } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { FileText, Download, CheckSquare } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { EmptyState } from "@/components/EmptyState";
import { TappableRow } from "@/components/TappableRow";
import { Tabs } from "@/components/Tabs";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Thead, Th, Tbody } from "@/components/ui/Table";
import { LinkButton } from "@/components/ui/Button";
import { UploadPayslipForm } from "./UploadPayslipForm";
import { AdvanceForm } from "./AdvanceForm";
import { AdvanceButtons } from "./AdvanceButtons";
import { AdvanceHistory, type AdvanceHistoryRow, type MonthOption } from "./AdvanceHistory";

const dh = (n: number) => `${n.toLocaleString("fr-FR")} DH`;


export default async function PaiePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id: userId, role } = session.user;
  const canManagePayslips = role === "MANAGER" || role === "ADMIN";
  const canReviewAdvances = role === "MANAGER" || role === "ADMIN" || role === "SUPERVISEUR";
  const company = await getActiveCompany(role, session.user.company);

  const [payslips, employees, advances] = await Promise.all([
    canManagePayslips
      ? prisma.payslip.findMany({
          where: { user: { company } },
          orderBy: { createdAt: "desc" },
          include: { user: { select: { name: true } } },
        })
      : prisma.payslip.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    canManagePayslips
      ? prisma.user.findMany({
          where: { role: { not: "ADMIN" }, company },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    canReviewAdvances
      ? prisma.salaryAdvance.findMany({
          where: { user: { company, ...(role === "SUPERVISEUR" ? { managerId: userId } : {}) } },
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        })
      : prisma.salaryAdvance.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
  ]);

  // ── Bulletins tab ───────────────────────────────────────────────────────────
  const bulletinsTab = (
    <div className="space-y-6">
      {canManagePayslips && <UploadPayslipForm employees={employees} />}
      <Card>
        <CardHeader title={canManagePayslips ? "Tous les bulletins" : "Mes bulletins"} />
        {payslips.length === 0 ? (
          <EmptyState icon={FileText} title="Aucun bulletin" description="Les bulletins de paie apparaîtront ici." />
        ) : (
          <Table>
              <Thead>
                  {canManagePayslips && <Th>Employé</Th>}
                  <Th>Mois</Th>
                  <Th className="hidden md:table-cell">Date d&apos;envoi</Th>
                  <Th>PDF</Th>
                  <Th className="w-8 md:hidden"><span className="sr-only">Détail</span></Th>
              </Thead>
              <Tbody>
                {payslips.map((p) => {
                  const employeeName = (p as { user?: { name?: string } }).user?.name ?? "";
                  const dateEnvoi = format(new Date(p.createdAt), "dd/MM/yyyy");
                  const pdfLink = p.pdfPath ? (
                    <LinkButton
                      href={`/api/payslips/${p.id}/download`}
                      aria-label={`Télécharger le bulletin ${p.month}`}
                    >
                      <Download className="size-3.5" aria-hidden />
                      Télécharger
                    </LinkButton>
                  ) : (
                    <span className="text-xs text-slate-500">Non disponible</span>
                  );
                  return (
                    <TappableRow
                      key={p.id}
                      className="hover:bg-slate-50/70"
                      detail={{
                        title: `Bulletin — ${p.month}`,
                        items: [
                          ...(canManagePayslips ? [{ label: "Employé", value: employeeName }] : []),
                          { label: "Mois", value: p.month },
                          { label: "Date d'envoi", value: dateEnvoi },
                          { label: "PDF", value: pdfLink },
                        ],
                      }}
                    >
                      {canManagePayslips && <td className="px-5 py-4 font-medium text-slate-800">{employeeName}</td>}
                      <td className="px-5 py-4 font-medium text-slate-800">{p.month}</td>
                      <td className="hidden px-5 py-4 text-slate-600 md:table-cell">{dateEnvoi}</td>
                      <td className="px-5 py-4">{pdfLink}</td>
                    </TappableRow>
                  );
                })}
              </Tbody>
          </Table>
        )}
      </Card>
    </div>
  );

  // ── Acomptes history ────────────────────────────────────────────────────────
  // One month is shown at a time, opening on the current one. Month keys and
  // labels are computed HERE (server) and passed down as strings, so the server
  // render and the browser can never disagree on which month a request is in.
  const now = new Date();
  const currentMonthKey = format(now, "yyyy-MM");
  const historyRows: AdvanceHistoryRow[] = advances.map((a) => ({
    id: a.id,
    monthKey: format(new Date(a.createdAt), "yyyy-MM"),
    dateLabel: format(new Date(a.createdAt), "dd/MM/yyyy"),
    userName: (a as { user?: { name?: string } }).user?.name,
    amount: a.amount,
    status: a.status,
    repaymentMonth: a.repaymentMonth,
    reason: a.reason,
    reviewNote: a.reviewNote,
  }));
  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    const label = format(new Date(y, m - 1, 1), "LLLL yyyy", { locale: fr });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };
  // Every month that has a request, plus the current one even when empty.
  const historyMonths: MonthOption[] = [...new Set([currentMonthKey, ...historyRows.map((r) => r.monthKey)])]
    .sort((a, b) => b.localeCompare(a))
    .map((key) => ({ key, label: monthLabel(key) }));

  // ── Avances tab ─────────────────────────────────────────────────────────────
  let avancesTab: React.ReactNode;
  let pendingCount = 0;

  if (!canReviewAdvances) {
    // Employee: request form + own history.
    avancesTab = (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Demander un acompte" />
          <CardBody>
            <AdvanceForm />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Mes demandes" />
          <AdvanceHistory
            rows={historyRows}
            months={historyMonths}
            currentKey={currentMonthKey}
            showEmployee={false}
          />
        </Card>
      </div>
    );
  } else {
    // Manager / Admin: pending approvals + team history.
    const teamAdvances = advances as Array<(typeof advances)[number] & { user: { name: string } }>;
    const pending = teamAdvances.filter((a) => a.status === "PENDING");
    pendingCount = pending.length;

    avancesTab = (
      <div className="space-y-6">
        {/* Pending approvals */}
        <Card>
          <CardHeader icon={CheckSquare} title="En attente de validation">
            {pendingCount > 0 && (
              <span className="grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold tabular-nums text-amber-800">
                {pendingCount}
              </span>
            )}
          </CardHeader>
          {pending.length === 0 ? (
            <EmptyState icon={CheckSquare} title="Tout est à jour" description="Aucune demande d'acompte en attente." />
          ) : (
            <Table>
                <Thead>
                    <Th>Salarié</Th>
                    <Th>Montant</Th>
                    <Th className="hidden md:table-cell">Remboursement</Th>
                    <Th className="hidden md:table-cell">Actions</Th>
                    <Th className="w-8 md:hidden"><span className="sr-only">Détail</span></Th>
                </Thead>
                <Tbody>
                  {pending.map((a) => (
                    <TappableRow
                      key={a.id}
                      className="hover:bg-slate-50/70"
                      detail={{
                        title: a.user.name,
                        items: [
                          { label: "Salarié", value: a.user.name },
                          { label: "Montant", value: dh(a.amount) },
                          { label: "Remboursement souhaité", value: a.repaymentMonth ?? "" },
                          { label: "Motif", value: a.reason ?? "" },
                          { label: "Date", value: format(new Date(a.createdAt), "dd/MM/yyyy") },
                        ],
                        actions: <AdvanceButtons id={a.id} />,
                      }}
                    >
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-800">{a.user.name}</p>
                        {a.reason && <p className="mt-0.5 text-xs italic text-slate-500">{a.reason}</p>}
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-800">{dh(a.amount)}</td>
                      <td className="hidden px-5 py-4 text-slate-600 md:table-cell">{a.repaymentMonth ?? "—"}</td>
                      <td className="hidden px-5 py-4 md:table-cell"><AdvanceButtons id={a.id} /></td>
                    </TappableRow>
                  ))}
                </Tbody>
            </Table>
          )}
        </Card>

        {/* Team history */}
        <Card>
          <CardHeader title="Historique équipe" />
          <AdvanceHistory
            rows={historyRows}
            months={historyMonths}
            currentKey={currentMonthKey}
            showEmployee
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Paie" />
      <Tabs
        defaultKey="bulletins"
        tabs={[
          { key: "bulletins", label: "Bulletins", content: bulletinsTab },
          { key: "avances", label: "Acomptes", badge: pendingCount || undefined, content: avancesTab },
        ]}
      />
    </div>
  );
}
