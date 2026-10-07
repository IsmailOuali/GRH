import { redirect } from "next/navigation";
import { Laptop, ClipboardCheck } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { formatFrIso, toIso } from "@/lib/dates";
import { monthStartIso } from "@/lib/teletravail";
import { buildPlanningEntries } from "@/lib/planning";
import { EmptyState } from "@/components/EmptyState";
import { Tabs } from "@/components/Tabs";
import { TappableRow } from "@/components/TappableRow";
import { PlanningCalendar } from "@/components/PlanningCalendar";
import { RemoteDayDeleteButton } from "@/components/RemoteDayDeleteButton";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Thead, Th, Tbody } from "@/components/ui/Table";
import { RemoteRequestButtons } from "@/components/suivi/RemoteRequestButtons";
import { RemoteWorkForm } from "./RemoteWorkForm";
import { RemoteWorkRequestForm } from "./RemoteWorkRequestForm";

const WEEKDAY_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

/** "Lundi 24/08/2026" — the weekday is what makes a recurring pattern readable. */
function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${WEEKDAY_FR[new Date(y, m - 1, d).getDay()]} ${formatFrIso(iso)}`;
}

export default async function TeletravailPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;
  const role = session.user.role;
  const isPlanner = role === "MANAGER" || role === "ADMIN" || role === "SUPERVISEUR";
  const company = await getActiveCompany(role, session.user.company);
  const todayIso = toIso(new Date());

  // The calendar can page back a couple of months; anything older than that is
  // history nobody plans against, so it stays out of the payload.
  const since = monthStartIso(-3);

  // Same scoping as the congés queue: MANAGER/ADMIN see the whole active
  // company, a SUPERVISEUR only their own team, an employee only themselves.
  const scopeFilter = isPlanner
    ? { user: { company, ...(role === "SUPERVISEUR" ? { managerId: userId } : {}) } }
    : { userId };

  const [days, employees] = await Promise.all([
    prisma.remoteWorkDay.findMany({
      where: { ...scopeFilter, date: { gte: since } },
      include: { user: { select: { name: true } } },
      orderBy: { date: "asc" },
    }),
    isPlanner
      ? prisma.user.findMany({
          where: { company, ...(role === "SUPERVISEUR" ? { managerId: userId } : {}) },
          select: { id: true, name: true, position: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  // Same planning component as /conges, scoped to télétravail only: one
  // calendar, two entry points.
  const planningEntries = buildPlanningEntries([], days);

  // "Jours planifiés" lists confirmed days only; anything still awaiting a
  // decision belongs in the validation queue, not in the schedule.
  const upcoming = days.filter((d) => d.date >= todayIso && d.status === "APPROVED");

  // One row per submission rather than per day: requestId groups the days an
  // employee asked for in one go, so a manager decides once.
  const pendingDays = days.filter((d) => d.status === "PENDING");
  const pendingRequests = [
    ...pendingDays
      .reduce((acc, d) => {
        const key = d.requestId ?? d.id;
        const entry = acc.get(key) ?? {
          requestId: key,
          name: d.user.name,
          note: d.note,
          dates: [] as string[],
          createdAt: d.createdAt,
        };
        entry.dates.push(d.date);
        acc.set(key, entry);
        return acc;
      }, new Map<string, { requestId: string; name: string; note: string | null; dates: string[]; createdAt: Date }>())
      .values(),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const pendingCard = (
    <Card>
      {pendingRequests.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Tout est à jour"
          description="Aucune demande de télétravail en attente."
        />
      ) : (
        <Table>
          <Thead>
            <Th>Salarié</Th>
            <Th>Jours demandés</Th>
            <Th className="hidden md:table-cell">Période</Th>
            <Th className="hidden lg:table-cell">Motif</Th>
            <Th>Actions</Th>
          </Thead>
          <Tbody>
            {pendingRequests.map((r) => {
              const sorted = [...r.dates].sort();
              return (
                <tr key={r.requestId}>
                  <td className="px-5 py-3.5 font-medium text-slate-800">{r.name}</td>
                  <td className="px-5 py-3.5 tabular-nums text-slate-700">
                    {r.dates.length} jour{r.dates.length > 1 ? "s" : ""}
                  </td>
                  <td className="hidden px-5 py-3.5 text-slate-600 md:table-cell">
                    {formatFrIso(sorted[0])} → {formatFrIso(sorted[sorted.length - 1])}
                  </td>
                  <td className="hidden px-5 py-3.5 text-slate-600 lg:table-cell">{r.note ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    <RemoteRequestButtons
                      requestId={r.requestId}
                      name={r.name}
                      days={r.dates.length}
                    />
                  </td>
                </tr>
              );
            })}
          </Tbody>
        </Table>
      )}
    </Card>
  );

  const requestCard = (
    <Card className="max-w-xl">
      <CardBody>
        <RemoteWorkRequestForm />
      </CardBody>
    </Card>
  );

  const header = (
    <PageHeader
      title="Télétravail"
      description={
        isPlanner
          ? "Planifiez les jours de télétravail de votre équipe et suivez-les au mois."
          : "Vos jours de télétravail planifiés par votre responsable."
      }
    />
  );

  const calendarCard = (
    <PlanningCalendar
      entries={planningEntries}
      people={employees.map((e) => ({ id: e.id, name: e.name }))}
      initialTypes={["TELETRAVAIL"]}
      lockTypes
      currentUserId={userId}
    />
  );

  const upcomingCard = (
    <Card>
      {upcoming.length === 0 ? (
        <EmptyState
          icon={Laptop}
          title="Aucun jour à venir"
          description={
            isPlanner
              ? "Planifiez du télétravail depuis l'onglet « Planifier »."
              : "Aucun jour de télétravail n'est planifié pour vous."
          }
        />
      ) : (
        <Table>
          <Thead>
            {isPlanner && <Th>Salarié</Th>}
            <Th>Date</Th>
            <Th className="hidden md:table-cell">Note</Th>
            {isPlanner && <Th className="hidden md:table-cell">Actions</Th>}
            <Th className="w-8 md:hidden"><span className="sr-only">Détail</span></Th>
          </Thead>
          <Tbody>
            {upcoming.map((d) => (
              <TappableRow
                key={d.id}
                className="hover:bg-slate-50/70"
                detail={{
                  title: isPlanner ? d.user.name : "Télétravail",
                  items: [
                    ...(isPlanner ? [{ label: "Salarié", value: d.user.name }] : []),
                    { label: "Date", value: longDate(d.date) },
                    { label: "Note", value: d.note ?? "—" },
                  ],
                  actions: isPlanner ? (
                    <RemoteDayDeleteButton id={d.id} name={d.user.name} date={formatFrIso(d.date)} />
                  ) : undefined,
                }}
              >
                {isPlanner && (
                  <td className="px-5 py-3.5 font-medium text-slate-800">{d.user.name}</td>
                )}
                <td className="px-5 py-3.5 text-slate-700">{longDate(d.date)}</td>
                <td className="hidden px-5 py-3.5 text-slate-600 md:table-cell">{d.note ?? "—"}</td>
                {isPlanner && (
                  <td className="hidden px-5 py-3.5 md:table-cell">
                    <RemoteDayDeleteButton id={d.id} name={d.user.name} date={formatFrIso(d.date)} />
                  </td>
                )}
              </TappableRow>
            ))}
          </Tbody>
        </Table>
      )}
    </Card>
  );

  // ── Employee view ──────────────────────────────────────────────────────────
  if (!isPlanner) {
    return (
      <div>
        {header}
        <Tabs
          defaultKey="demande"
          tabs={[
            { key: "demande", label: "Demander un télétravail", content: requestCard },
            { key: "jours", label: "Mes jours à venir", badge: upcoming.length, content: upcomingCard },
          ]}
        />
      </div>
    );
  }

  // ── Manager / Admin / Superviseur view ─────────────────────────────────────
  const formCard = (
    <Card className="max-w-xl">
      <CardBody>
        <RemoteWorkForm employees={employees} />
      </CardBody>
    </Card>
  );

  return (
    <div>
      {header}
      <Tabs
        defaultKey="attente"
        tabs={[
          { key: "attente", label: "En attente", badge: pendingRequests.length, content: pendingCard },
          { key: "calendrier", label: "Calendrier", content: calendarCard },
          { key: "jours", label: "Jours planifiés", badge: upcoming.length, content: upcomingCard },
          { key: "planifier", label: "Planifier", content: formCard },
        ]}
      />
    </div>
  );
}
