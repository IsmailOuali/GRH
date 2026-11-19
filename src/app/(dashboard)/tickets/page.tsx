import { redirect } from "next/navigation";
import { format } from "date-fns";
import { LifeBuoy, MessageSquareReply } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Tabs } from "@/components/Tabs";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { TICKET_CATEGORY_LABELS } from "@/lib/tickets";
import { TicketForm } from "./TicketForm";
import { TicketReply } from "./TicketReply";

type TicketRow = {
  id: string;
  userId: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  response: string | null;
  respondedAt: Date | null;
  createdAt: Date;
  user?: { name: string };
};

/** One ticket: what was asked, the RH's answer, and (for the RH) the reply form. */
function TicketItem({ t, children }: { t: TicketRow; children?: React.ReactNode }) {
  return (
    <li className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{t.subject || "(sans objet)"}</p>
          <p className="text-xs text-slate-500">
            {t.user && <>{t.user.name} · </>}
            {TICKET_CATEGORY_LABELS[t.category] ?? t.category} · {format(t.createdAt, "dd/MM/yyyy")}
          </p>
        </div>
        <StatusBadge status={t.status} />
      </div>

      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{t.description}</p>

      {t.response && (
        <div className="rounded-xl bg-brand-50/60 px-3.5 py-3 ring-1 ring-inset ring-brand-100">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-brand-700">
            <MessageSquareReply className="size-3.5" aria-hidden />
            Réponse des RH
            {t.respondedAt && (
              <span className="font-normal text-slate-500">· {format(t.respondedAt, "dd/MM/yyyy")}</span>
            )}
          </p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-800">{t.response}</p>
        </div>
      )}

      {children}
    </li>
  );
}

function TicketList({
  tickets,
  empty,
  reply,
}: {
  tickets: TicketRow[];
  empty: { title: string; description: string };
  reply?: (t: TicketRow) => React.ReactNode;
}) {
  return (
    <Card>
      {tickets.length === 0 ? (
        <EmptyState icon={LifeBuoy} title={empty.title} description={empty.description} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {tickets.map((t) => (
            <TicketItem key={t.id} t={t}>
              {reply?.(t)}
            </TicketItem>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default async function TicketsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;
  const role = session.user.role;
  const isHr = role === "MANAGER" || role === "ADMIN";
  const company = await getActiveCompany(role, session.user.company);

  const mine = await prisma.ticket.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const formCard = (
    <Card className="max-w-xl">
      <CardBody>
        <p className="mb-4 text-sm text-slate-600">
          Une erreur sur votre bulletin, votre solde de congés ou vos informations ? Écrivez aux RH : leur réponse
          apparaîtra ici.
        </p>
        <TicketForm />
      </CardBody>
    </Card>
  );

  const mineCard = (
    <TicketList
      tickets={mine}
      empty={{ title: "Aucun ticket", description: "Vos signalements aux RH et leurs réponses apparaîtront ici." }}
    />
  );

  // ── Salarié / superviseur ──────────────────────────────────────────────────
  if (!isHr) {
    return (
      <div>
        <PageHeader title="Tickets RH" description="Signaler une erreur aux RH." />
        <Tabs
          defaultKey="nouveau"
          tabs={[
            { key: "nouveau", label: "Nouveau ticket", content: formCard },
            { key: "mes", label: "Mes tickets", content: mineCard },
          ]}
        />
      </div>
    );
  }

  // ── RH (manager / admin): the company's queue ──────────────────────────────
  const [active, resolved] = await Promise.all([
    prisma.ticket.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] }, user: { company } },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "asc" }, // longest-waiting first
    }),
    prisma.ticket.findMany({
      where: { status: "RESOLVED", user: { company } },
      include: { user: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  const replyFor = (t: TicketRow) => (
    <TicketReply
      id={t.id}
      status={t.status}
      disabledReason={
        t.userId === userId ? "C'est votre propre ticket : un autre responsable doit y répondre." : undefined
      }
    />
  );

  return (
    <div>
      <PageHeader title="Tickets RH" description="Signalements d'erreur des salariés." />
      <Tabs
        defaultKey="traiter"
        tabs={[
          {
            key: "traiter",
            label: "À traiter",
            badge: active.length,
            content: (
              <TicketList
                tickets={active}
                empty={{ title: "Tout est à jour", description: "Aucun ticket en attente de réponse." }}
                reply={replyFor}
              />
            ),
          },
          {
            key: "resolus",
            label: "Résolus",
            content: (
              <TicketList
                tickets={resolved}
                empty={{ title: "Aucun ticket résolu", description: "Les tickets traités apparaîtront ici." }}
              />
            ),
          },
          { key: "nouveau", label: "Nouveau ticket", content: formCard },
          { key: "mes", label: "Mes tickets", content: mineCard },
        ]}
      />
    </div>
  );
}
