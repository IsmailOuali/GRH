import { redirect } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, Newspaper, IdCard, Mail, Building2, Hash } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { AbsenceTeamCard } from "@/components/AbsenceTeamCard";
import { NewsDeleteButton } from "@/components/NewsDeleteButton";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardHeader, CardEyebrow } from "@/components/ui/Card";
import { accrueLeaveBalance } from "@/lib/accrual";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;
  const role = session.user.role;
  const isManager = role === "MANAGER" || role === "ADMIN";
  const company = await getActiveCompany(role, session.user.company);

  // Lazy accrual: credit any whole month(s) elapsed before the balance is read.
  await accrueLeaveBalance(userId);

  const [balance, approvedLeaves, news, dossier] = await Promise.all([
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

  // All approved absences (for the calendar) + today's subset (for the count).
  const teamAbsences = approvedLeaves.map((r) => ({
    name: r.user.name,
    type: r.type,
    start: format(new Date(r.startDate), "yyyy-MM-dd"),
    end: format(new Date(r.endDate), "yyyy-MM-dd"),
  }));
  const todayIso = format(new Date(), "yyyy-MM-dd");
  const rawToday = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });
  const todayLabel = rawToday.charAt(0).toUpperCase() + rawToday.slice(1);
  const absentNames = teamAbsences
    .filter((a) => a.start <= todayIso && todayIso <= a.end)
    .map((a) => a.name);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
          Bonjour, {session.user.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500 first-letter:uppercase">{todayLabel}</p>
      </div>

      {/* Two-column at lg: a rail of stat cards beside the feed. Stacking all
          of it full-width left the lower two thirds of a desktop page empty
          and made the feed's line length uncomfortably long. */}
      <div className="grid items-start gap-5 lg:grid-cols-3">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          {dossier && (
            <Card className="p-5">
              <CardEyebrow icon={IdCard} tone="emerald">
                Mes informations
              </CardEyebrow>
              <p className="mt-4 truncate text-lg font-semibold tracking-tight text-slate-900">
                {dossierName}
              </p>
              {dossier.poste && <p className="truncate text-sm text-slate-500">{dossier.poste}</p>}
              {infoRows.length > 0 && (
                <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-4">
                  {infoRows.map(({ icon: Icon, value }) => (
                    <div key={value} className="flex items-center gap-2 text-sm text-slate-600">
                      <Icon className="size-3.5 shrink-0 text-slate-400" aria-hidden />
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
              <span className="text-[2rem] font-semibold leading-none tabular-nums tracking-tight text-slate-900">
                {balance?.cpDays ?? 0}
              </span>
              <span className="text-sm text-slate-500">jours CP</span>
            </p>
            {balance?.expiryDate && (
              <p className="mt-2 text-xs text-slate-500">
                Expire le {format(new Date(balance.expiryDate), "dd/MM/yyyy")}
              </p>
            )}
          </Card>

          {/* Team absences (manager/admin only) */}
          {isManager && (
            <AbsenceTeamCard count={absentNames.length} employees={absentNames} absences={teamAbsences} />
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
            <ul className="divide-y divide-slate-100">
              {news.map((item) => (
                <li key={item.id} className="group flex items-start gap-3 px-5 py-4 transition-colors hover:bg-slate-50/60">
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                      {item.content}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500">
                      {item.publishedBy.name} ·{" "}
                      <time dateTime={new Date(item.createdAt).toISOString()}>
                        {format(new Date(item.createdAt), "dd/MM/yyyy")}
                      </time>
                    </p>
                  </div>
                  {role === "ADMIN" && <NewsDeleteButton id={item.id} />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
