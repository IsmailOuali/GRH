import { redirect } from "next/navigation";
import { format } from "date-fns";
import { CalendarDays, CheckSquare, Download } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { ValidationButtons } from "@/components/ValidationButtons";
import { TappableRow } from "@/components/TappableRow";
import { Tabs } from "@/components/Tabs";
import { PlanningCalendar } from "@/components/PlanningCalendar";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Thead, Th, Tbody } from "@/components/ui/Table";
import { LinkButton } from "@/components/ui/Button";
import { nextBusinessDay } from "@/lib/dates";
import { buildPlanningEntries } from "@/lib/planning";
import { accrueLeaveBalance } from "@/lib/accrual";
import { SuiviImporter } from "@/components/suivi/SuiviImporter";
import { SuiviKpis, SuiviAlerts, SuiviTable, SuiviStats } from "@/components/suivi/SuiviPanels";
import { computeSuivi, joursOuvresDuMois } from "@/lib/suivi/compute";
import { LeaveForm } from "./LeaveForm";

const TYPE_LABELS: Record<string, string> = {
  CP: "Congés Payés", RTT: "RTT", MALADIE: "Maladie", SANS_SOLDE: "Sans Solde",
};

function periodeOf(r: { startDate: Date; endDate: Date }) {
  return `${format(new Date(r.startDate), "dd/MM/yyyy")} – ${format(new Date(r.endDate), "dd/MM/yyyy")}`;
}

function repriseOf(r: { endDate: Date }) {
  return format(nextBusinessDay(new Date(r.endDate)), "dd/MM/yyyy");
}

// Attestation PDF only exists for approved CP requests (see reviewLeave).
function pdfLinkOf(r: { id: string; status: string; pdfPath: string | null }) {
  return r.status === "APPROVED" && r.pdfPath ? (
    <LinkButton href={`/api/leaves/${r.id}/download`} aria-label="Télécharger l'attestation de congés payés">
      <Download className="size-3.5" aria-hidden />
      Télécharger
    </LinkButton>
  ) : (
    <span className="text-xs text-slate-500">—</span>
  );
}

export default async function CongesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;
  const role = session.user.role;
  const isManager = role === "MANAGER" || role === "ADMIN" || role === "SUPERVISEUR";
  const company = await getActiveCompany(role, session.user.company);

  // Lazy accrual: credit any whole month(s) elapsed before the balance is read.
  await accrueLeaveBalance(userId);

  const [balance, requests] = await Promise.all([
    prisma.leaveBalance.findUnique({ where: { userId } }),
    isManager
      ? prisma.leaveRequest.findMany({
          where: { user: { company, ...(role === "SUPERVISEUR" ? { managerId: userId } : {}) } },
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        })
      : prisma.leaveRequest.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        }),
  ]);

  // The mobile top bar already shows the section title, so PageHeader keeps the
  // <h1> for assistive tech but hides it visually below md.
  const header = (
    <PageHeader
      title="Congés & Absences"
      description={
        balance ? (
          <span className="inline-flex flex-wrap items-center gap-x-1.5">
            Solde :
            <span className="font-medium text-slate-700">{balance.cpDays} CP</span>·
            <span className="font-medium text-slate-700">{balance.rttDays} RTT</span>
          </span>
        ) : undefined
      }
    />
  );

  // Capped: a form this narrow inside a full-width card leaves a dead right
  // half and makes the eye travel further than the content does.
  const formCard = (
    <Card className="max-w-xl">
      <CardBody>
        <LeaveForm />
      </CardBody>
    </Card>
  );

  // ── Employee view ──────────────────────────────────────────────────────────
  if (!isManager) {
    const historyCard = (
      <Card>
        {requests.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Aucune demande" description="Les demandes de congé apparaîtront ici." />
        ) : (
          <Table>
              <Thead>
                  <Th>Période</Th>
                  <Th className="hidden md:table-cell">Type</Th>
                  <Th className="hidden md:table-cell">Jours</Th>
                  <Th>Statut</Th>
                  <Th className="hidden md:table-cell">PDF</Th>
                  <Th className="w-8 md:hidden"><span className="sr-only">Détail</span></Th>
              </Thead>
              <Tbody>
                {requests.map((r) => {
                  const periode = periodeOf(r);
                  return (
                    <TappableRow
                      key={r.id}
                      className="hover:bg-slate-50/70"
                      detail={{
                        title: "Demande de congé",
                        items: [
                          { label: "Période", value: periode },
                          { label: "Reprise", value: repriseOf(r) },
                          { label: "Type", value: TYPE_LABELS[r.type] ?? r.type },
                          { label: "Jours", value: r.days },
                          { label: "Statut", value: <StatusBadge status={r.status} /> },
                          { label: "PDF", value: pdfLinkOf(r) },
                        ],
                      }}
                    >
                      <td className="px-5 py-3.5 font-medium text-slate-800">{periode}</td>
                      <td className="hidden px-5 py-3.5 text-slate-600 md:table-cell">{TYPE_LABELS[r.type] ?? r.type}</td>
                      <td className="hidden px-5 py-3.5 text-slate-600 md:table-cell">{r.days}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={r.status} /></td>
                      <td className="hidden px-5 py-3.5 md:table-cell">{pdfLinkOf(r)}</td>
                    </TappableRow>
                  );
                })}
              </Tbody>
          </Table>
        )}
      </Card>
    );

    return (
      <div>
        {header}
        <Tabs
          defaultKey="nouvelle"
          tabs={[
            { key: "nouvelle", label: "Nouvelle demande", content: formCard },
            { key: "historique", label: "Historique", content: historyCard },
          ]}
        />
      </div>
    );
  }

  // ── Manager / Admin view ───────────────────────────────────────────────────
  // ── Suivi RH ───────────────────────────────────────────────────────────────
  // Imported from the "Salariés" CSV, so this population is independent of the
  // app's user accounts: a tracked salarie may have no account, and an account
  // may have no tracked record until an import links them by name.
  const tracked = await prisma.trackedEmployee.findMany({
    where: { company },
    orderBy: { nomComplet: "asc" },
  });
  const now = new Date();
  const joursOuvres = joursOuvresDuMois(now.getFullYear(), now.getMonth() + 1);
  const suivi = computeSuivi(tracked, joursOuvres);

  // In this branch every request includes the employee (see query above).
  const teamRequests = requests as Array<
    (typeof requests)[number] & { user: { name: string } }
  >;
  const pendingRequests = teamRequests.filter((r) => r.status === "PENDING");

  // The planning merges congés with télétravail, so it needs the remote days
  // and the roster too — a salarié with nothing booked still gets a row.
  const [planningRemote, roster] = await Promise.all([
    prisma.remoteWorkDay.findMany({
      where: { user: { company, ...(role === "SUPERVISEUR" ? { managerId: userId } : {}) } },
      include: { user: { select: { name: true } } },
    }),
    prisma.user.findMany({
      where: { company, ...(role === "SUPERVISEUR" ? { managerId: userId } : {}) },
      select: { id: true, name: true, managerId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const planningEntries = buildPlanningEntries(teamRequests, planningRemote);

  const calendarCard = (
    <PlanningCalendar
      entries={planningEntries}
      people={roster.map((u) => ({ id: u.id, name: u.name }))}
      currentUserId={userId}
      teamIds={roster.filter((u) => u.managerId === userId).map((u) => u.id)}
    />
  );

  const pendingCard = (
    <Card>
      {pendingRequests.length === 0 ? (
        <EmptyState icon={CheckSquare} title="Tout est à jour" description="Aucune demande en attente de validation." />
      ) : (
        <Table>
            <Thead>
                <Th>Salarié</Th>
                <Th className="hidden md:table-cell">Type</Th>
                <Th>Période</Th>
                <Th className="hidden md:table-cell">Jours</Th>
                <Th className="hidden md:table-cell">Actions</Th>
                <Th className="w-8 md:hidden"><span className="sr-only">Détail</span></Th>
            </Thead>
            <Tbody>
              {pendingRequests.map((r) => {
                const periode = periodeOf(r);
                return (
                  <TappableRow
                    key={r.id}
                    className="hover:bg-slate-50/70"
                    detail={{
                      title: r.user.name,
                      items: [
                        { label: "Salarié", value: r.user.name },
                        ...(r.comment ? [{ label: "Commentaire", value: r.comment }] : []),
                        { label: "Type", value: TYPE_LABELS[r.type] ?? r.type },
                        { label: "Période", value: periode },
                        { label: "Reprise", value: repriseOf(r) },
                        { label: "Jours", value: r.days },
                      ],
                      actions: <ValidationButtons id={r.id} />,
                    }}
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-800">{r.user.name}</p>
                      {r.comment && (
                        <p className="mt-0.5 text-xs italic text-slate-500">{r.comment}</p>
                      )}
                    </td>
                    <td className="hidden px-5 py-4 text-slate-600 md:table-cell">{TYPE_LABELS[r.type] ?? r.type}</td>
                    <td className="px-5 py-4 text-slate-600">{periode}</td>
                    <td className="hidden px-5 py-4 text-slate-600 md:table-cell">{r.days}</td>
                    <td className="hidden px-5 py-4 md:table-cell">
                      <ValidationButtons id={r.id} />
                    </td>
                  </TappableRow>
                );
              })}
            </Tbody>
        </Table>
      )}
    </Card>
  );

  const teamHistoryCard = (
    <Card>
      {teamRequests.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Aucune demande" description="Les demandes de congé apparaîtront ici." />
      ) : (
        <Table>
            <Thead>
                <Th>Employé</Th>
                <Th className="hidden md:table-cell">Période</Th>
                <Th className="hidden md:table-cell">Type</Th>
                <Th className="hidden md:table-cell">Jours</Th>
                <Th>Statut</Th>
                <Th className="hidden md:table-cell">PDF</Th>
                <Th className="w-8 md:hidden"><span className="sr-only">Détail</span></Th>
            </Thead>
            <Tbody>
              {teamRequests.map((r) => {
                const periode = periodeOf(r);
                return (
                  <TappableRow
                    key={r.id}
                    className="hover:bg-slate-50/70"
                    detail={{
                      title: r.user.name,
                      items: [
                        { label: "Employé", value: r.user.name },
                        { label: "Période", value: periode },
                        { label: "Reprise", value: repriseOf(r) },
                        { label: "Type", value: TYPE_LABELS[r.type] ?? r.type },
                        { label: "Jours", value: r.days },
                        { label: "Statut", value: <StatusBadge status={r.status} /> },
                        { label: "PDF", value: pdfLinkOf(r) },
                      ],
                    }}
                  >
                    <td className="px-5 py-3.5 font-medium text-slate-800">{r.user.name}</td>
                    <td className="hidden px-5 py-3.5 text-slate-700 md:table-cell">{periode}</td>
                    <td className="hidden px-5 py-3.5 text-slate-600 md:table-cell">{TYPE_LABELS[r.type] ?? r.type}</td>
                    <td className="hidden px-5 py-3.5 text-slate-600 md:table-cell">{r.days}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={r.status} /></td>
                    <td className="hidden px-5 py-3.5 md:table-cell">{pdfLinkOf(r)}</td>
                  </TappableRow>
                );
              })}
            </Tbody>
        </Table>
      )}
    </Card>
  );

  const importCard = (
    <Card className="max-w-3xl">
      <CardBody>
        <SuiviImporter />
      </CardBody>
    </Card>
  );

  return (
    <div>
      {header}
      {/* At-a-glance layer sits above the tabs so the headline figures and any
          threshold breach stay visible whichever tab is open. */}
      <SuiviKpis totals={suivi} joursOuvres={joursOuvres} />
      <SuiviAlerts totals={suivi} />
      <Tabs
        defaultKey="pending"
        tabs={[
          { key: "pending", label: "En attente de validation", badge: pendingRequests.length, content: pendingCard },
          { key: "suivi", label: "Suivi RH", badge: suivi.effectif, content: <SuiviTable totals={suivi} /> },
          { key: "stats", label: "Statistiques", content: <SuiviStats totals={suivi} /> },
          { key: "import", label: "Import CSV", content: importCard },
          { key: "calendrier", label: "Planning", content: calendarCard },
          { key: "historique", label: "Historique équipe", content: teamHistoryCard },
          { key: "nouvelle", label: "Nouvelle demande", content: formCard },
        ]}
      />
    </div>
  );
}
