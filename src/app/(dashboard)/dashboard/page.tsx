import { redirect } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, Newspaper, IdCard, Mail, Building2, Hash } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { AbsenceTeamCard } from "@/components/AbsenceTeamCard";
import { buildPlanningEntries } from "@/lib/planning";
import { NewsDeleteButton } from "@/components/NewsDeleteButton";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardHeader, CardEyebrow } from "@/components/ui/Card";
import { accrueLeaveBalance } from "@/lib/accrual";
import { getPendingSummary } from "@/lib/notifications";
import { PendingActionsCard } from "@/components/PendingActionsCard";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;
  const role = session.user.role;
  const isManager = role === "MANAGER" || role === "ADMIN";
  const company = await getActiveCompany(role, session.user.company);

  // Lazy accrual: credit any whole month(s) elapsed before the balance is read.
  await accrueLeaveBalance(userId);

  const [pending, balance, approvedLeaves, remoteDays, roster, news, dossier] = await Promise.all([
    // Empty for employees; SUPERVISEUR is included (team-scoped) even though
    // they don't get the company planning below.
    getPendingSummary(role, userId, company),
    prisma.leaveBalance.findUnique({ where: { userId } }),
    isManager
      ? prisma.leaveRequest.findMany({
          where: {
            status: "APPROVED",
            user: {
              company,
              ...(role === "MANAGER" ? { managerId: userId } : {}),
            },
          },
          include: { user: { select: { name: true } } },
          orderBy: { startDate: "asc" },
        })
      : Promise.resolve([]),
    // Télétravail belongs on the planning too — without it a month with no
    // congés looked broken rather than simply quiet.
    isManager
      ? prisma.remoteWorkDay.findMany({
          where: { user: { company, ...(role === "MANAGER" ? { managerId: userId } : {}) } },
          include: { user: { select: { name: true } } },
        })
      : Promise.resolve([]),
    // The roster gives every salarié a row, so the planning shows "personne
    // n'est absent" as an empty grid instead of an empty-state message.
    isManager
      ? prisma.user.findMany({
          where: { company, ...(role === "MANAGER" ? { managerId: userId } : {}) },
          select: { id: true, name: true, managerId: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    prisma.news.findMany({
      where: { company },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { publishedBy: true },
    }),
    // The dossier linked to the current user feeds the info card below.
    prisma.employeeDossier.findFirst({
      where: { userId, company },
      orderBy: { updatedAt: "desc" },
      select: { prenom: true, nom: true, poste: true, emailPro: true, departement: true, matricule: true },
    }),
  ]);

  // Congés + télétravail, expanded to one entry per person per day.
  const teamAbsences = buildPlanningEntries(approvedLeaves, remoteDays);
  const todayIso = format(new Date(), "yyyy-MM-dd");
  const rawToday = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });
  const todayLabel = rawToday.charAt(0).toUpperCase() + rawToday.slice(1);
  // Only real absences count here: someone en télétravail is working, so
  // they must not appear in "Absences équipe aujourd'hui".
  const absentNames = [
    ...new Set(
      teamAbsences
        .filter((a) => a.date === todayIso && !a.countsAsWorked)
        .map((a) => a.name),
    ),
  ];

  const dossierName = dossier
    ? [dossier.prenom, dossier.nom].filter(Boolean).join(" ") || (session.user.name ?? "")
    : "";
  const infoRows = dossier
    ? ([
        { icon: Mail, value: dossier.emailPro },
        { icon: Building2, value: dossier.departement },
        { icon: Hash, value: dossier.matricule },
      ].filter((r) => r.value && r.value.trim()) as { icon: typeof Mail; value: string }[])
    : [];

  const initials = (session.user.name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="animate-rise space-y-8">
      {/* Identity-forward header: a brand-tinted avatar anchors the greeting,
          the date drops to muted metadata. Bold-on-muted weight contrast. */}
      <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-card backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.03]">
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white ring-2 ring-white dark:ring-white/10"
        >
          {initials || "?"}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 md:text-2xl dark:text-white">
            Bonjour, {session.user.name}
          </h1>
          <p className="mt-0.5 truncate text-sm text-slate-500 first-letter:uppercase dark:text-neutral-400">
            {todayLabel}
          </p>
        </div>
      </div>

      {/* Two-column at lg: a rail of stat cards beside the feed. Stacking all
          of it full-width left the lower two thirds of a desktop page empty
          and made the feed's line length uncomfortably long. */}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          {(isManager || role === "SUPERVISEUR") && <PendingActionsCard items={pending} />}

          {dossier && (
            <Card className="p-5">
              <CardEyebrow icon={IdCard} tone="emerald">
                Mes informations
              </CardEyebrow>
              <p className="mt-4 truncate text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                {dossierName}
              </p>
              {dossier.poste && <p className="truncate text-sm text-slate-500 dark:text-neutral-400">{dossier.poste}</p>}
              {infoRows.length > 0 && (
                <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 dark:border-white/10">
                  {infoRows.map(({ icon: Icon, value }) => (
                    <div key={value} className="flex items-center gap-2 text-sm text-slate-600 dark:text-neutral-300">
                      <Icon className="size-3.5 shrink-0 text-slate-400 dark:text-neutral-500" aria-hidden />
                      <span className="truncate">{value}</span>
                    </div>
                  ))}
                </dl>
              )}
            </Card>
          )}

          {/* Leave balance */}
          <Card className="p-5">
            <CardEyebrow icon={CalendarDays} tone="brand">
              Solde de congés
            </CardEyebrow>
            <p className="mt-4 flex items-baseline gap-1.5">
              <span className="text-[2rem] font-bold leading-none tabular-nums tracking-tight text-slate-900 dark:text-white">
                {balance?.cpDays ?? 0}
              </span>
              <span className="text-sm text-slate-500 dark:text-neutral-400">jours CP</span>
            </p>
            {balance?.expiryDate && (
              <p className="mt-2 text-xs text-slate-500 dark:text-neutral-500">
                Expire le {format(new Date(balance.expiryDate), "dd/MM/yyyy")}
              </p>
            )}
          </Card>

          {/* Team absences (manager/admin only) */}
          {isManager && (
            <AbsenceTeamCard
              count={absentNames.length}
              employees={absentNames}
              absences={teamAbsences}
              people={roster.map((u) => ({ id: u.id, name: u.name }))}
              currentUserId={userId}
              teamIds={roster.filter((u) => u.managerId === userId).map((u) => u.id)}
            />
          )}
        </div>

        {/* News feed */}
        <Card className="lg:col-span-2">
          <CardHeader icon={Newspaper} title="Actualités" />
          {news.length === 0 ? (
            <EmptyState
              icon={Newspaper}
              title="Aucune actualité"
              description="Les annonces publiées par la direction apparaîtront ici."
            />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/10">
              {news.map((item) => {
                const authorInitials = item.publishedBy.name
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase() ?? "")
                  .join("");
                return (
                  <li
                    key={item.id}
                    className="group flex items-start gap-3 px-5 py-4 transition-colors hover:bg-slate-50/60 dark:hover:bg-white/[0.03]"
                  >
                    {/* Author avatar puts a face on each announcement — the feed
                        reads as posts, not rows. */}
                    <span
                      aria-hidden
                      className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-[0.6875rem] font-bold text-slate-500 dark:bg-white/10 dark:text-neutral-300"
                    >
                      {authorInitials || "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-xs">
                        <span className="font-semibold text-slate-900 dark:text-neutral-100">
                          {item.publishedBy.name}
                        </span>
                        <span className="text-slate-400 dark:text-neutral-600">·</span>
                        <time
                          dateTime={new Date(item.createdAt).toISOString()}
                          className="text-slate-500 dark:text-neutral-500"
                        >
                          {format(new Date(item.createdAt), "dd/MM/yyyy")}
                        </time>
                      </p>
                      {/* line-clamp-3 keeps a long announcement from dominating
                          the feed; the full text stays in the title tooltip. */}
                      <p
                        title={item.content}
                        className="mt-1 line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-neutral-300"
                      >
                        {item.content}
                      </p>
                    </div>
                    {role === "ADMIN" && <NewsDeleteButton id={item.id} />}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
