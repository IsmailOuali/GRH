import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { LEAVE_TYPE_LABELS } from "@/lib/leave-types";
import { TEMPLATES_MAP } from "@/lib/documents/templates.config";
import { TOPIC_LABELS } from "@/lib/profile-changes";
import { formatFrIso } from "@/lib/dates";

/**
 * "Mes demandes" — what a salarié still has in flight, and the answers they have
 * not opened yet. Feeds the dashboard card.
 *
 *  - pending: read from each request table (still waiting for the RH).
 *  - responses: the UNREAD notifications that announce a decision or an answer.
 *    "Opening" one (a click on the card, or on the bell) marks it read, and it
 *    leaves the card — the same flag as the bell, so the two never disagree.
 */

export type PendingRequest = {
  key: string;
  /** Short category, e.g. "Congé", "Acompte". */
  kind: string;
  /** What it is, e.g. "Congés Payés · 14/07 – 18/07". */
  title: string;
  href: string;
  createdAt: Date;
  /** PENDING = not looked at yet · IN_PROGRESS = taken by the RH. */
  state: "PENDING" | "IN_PROGRESS";
};

export type UnreadResponse = {
  /** Notification id: opening it marks it read. */
  id: string;
  message: string;
  href: string;
  createdAt: Date;
};

export type MyRequests = {
  pending: PendingRequest[];
  responses: UnreadResponse[];
};

/** Notification types that announce a decision on / an answer to one of my requests. */
const RESPONSE_TYPES = [
  "LEAVE_REVIEWED",
  "ADVANCE_REVIEWED",
  "DOCUMENT_REVIEWED",
  "REMOTE_REVIEWED",
  "TICKET_ANSWERED",
  "PROFILE_CHANGE_REVIEWED",
];

const dm = (d: Date) => format(d, "dd/MM");

export async function getMyRequests(userId: string): Promise<MyRequests> {
  const [leaves, remote, documents, advances, tickets, changes, notifications] = await Promise.all([
    prisma.leaveRequest.findMany({ where: { userId, status: "PENDING" } }),
    prisma.remoteWorkDay.findMany({
      where: { userId, status: "PENDING" },
      select: { id: true, requestId: true, date: true, createdAt: true },
      orderBy: { date: "asc" },
    }),
    prisma.documentRequest.findMany({ where: { userId, status: "PENDING" } }),
    prisma.salaryAdvance.findMany({ where: { userId, status: "PENDING" } }),
    prisma.ticket.findMany({ where: { userId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.profileChangeRequest.findMany({ where: { userId, status: "PENDING" } }),
    prisma.notification.findMany({
      where: { userId, read: false, type: { in: RESPONSE_TYPES } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const pending: PendingRequest[] = [];

  for (const l of leaves) {
    const label = LEAVE_TYPE_LABELS[l.type] ?? l.type;
    const period =
      l.startDate.getTime() === l.endDate.getTime() ? dm(l.startDate) : `${dm(l.startDate)} – ${dm(l.endDate)}`;
    pending.push({
      key: `leave-${l.id}`,
      kind: "Congé / absence",
      title: `${label} · ${period}`,
      href: "/conges",
      createdAt: l.createdAt,
      state: "PENDING",
    });
  }

  // Remote days are one row each; collapse them to one entry per submission.
  const remoteRequests = new Map<string, { days: string[]; createdAt: Date }>();
  for (const day of remote) {
    const id = day.requestId ?? day.id;
    const entry = remoteRequests.get(id) ?? { days: [], createdAt: day.createdAt };
    entry.days.push(day.date);
    remoteRequests.set(id, entry);
  }
  for (const [id, r] of remoteRequests) {
    pending.push({
      key: `remote-${id}`,
      kind: "Télétravail",
      title: r.days.length === 1 ? `Télétravail · ${formatFrIso(r.days[0])}` : `Télétravail · ${r.days.length} jours`,
      href: "/teletravail",
      createdAt: r.createdAt,
      state: "PENDING",
    });
  }

  for (const d of documents) {
    pending.push({
      key: `doc-${d.id}`,
      kind: "Document",
      title: TEMPLATES_MAP[d.templateId]?.label ?? "Demande de document",
      href: "/documents",
      createdAt: d.createdAt,
      state: "PENDING",
    });
  }

  for (const a of advances) {
    pending.push({
      key: `advance-${a.id}`,
      kind: "Acompte",
      title: `Acompte sur salaire · ${a.amount} DH`,
      href: "/paie",
      createdAt: a.createdAt,
      state: "PENDING",
    });
  }

  for (const t of tickets) {
    pending.push({
      key: `ticket-${t.id}`,
      kind: "Ticket RH",
      title: t.subject || "Ticket RH",
      href: "/tickets",
      createdAt: t.createdAt,
      state: t.status === "IN_PROGRESS" ? "IN_PROGRESS" : "PENDING",
    });
  }

  for (const c of changes) {
    pending.push({
      key: `change-${c.id}`,
      kind: "Ma fiche",
      title: `Modification · ${TOPIC_LABELS[c.topic] ?? c.topic}`,
      href: "/mes-informations",
      createdAt: c.createdAt,
      state: "PENDING",
    });
  }

  pending.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    pending,
    responses: notifications.map((n) => ({
      id: n.id,
      message: n.message,
      href: n.link ?? "/dashboard",
      createdAt: n.createdAt,
    })),
  };
}
