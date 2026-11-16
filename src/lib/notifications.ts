import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { isMailConfigured, sendNotificationEmail } from "@/lib/mail";

export type NotificationType =
  | "LEAVE_SUBMITTED"
  | "LEAVE_REVIEWED"
  | "ADVANCE_SUBMITTED"
  | "ADVANCE_REVIEWED"
  | "DOCUMENT_SUBMITTED"
  | "DOCUMENT_REVIEWED"
  | "REMOTE_ASSIGNED"
  | "REMOTE_CANCELLED"
  | "REMOTE_SUBMITTED"
  | "REMOTE_REVIEWED"
  | "VAULT_DOCUMENT_ADDED";

/**
 * Pending "demandes" awaiting a reviewer, keyed by nav href so the
 * sidebar/mobile nav can show a badge. Scoped exactly like each page's queue:
 *   - MANAGER/ADMIN: the whole active company
 *   - SUPERVISEUR:   their own team (managerId) only, and no document count —
 *     they don't review document requests
 * Returns {} for employees.
 */
export async function getPendingCounts(
  role: string,
  userId: string,
  company: string,
): Promise<Record<string, number>> {
  if (role !== "MANAGER" && role !== "ADMIN" && role !== "SUPERVISEUR") return {};
  const isSupervisor = role === "SUPERVISEUR";
  const teamFilter = isSupervisor ? { managerId: userId } : {};

  const [conges, documents, paie, teletravail] = await Promise.all([
    prisma.leaveRequest.count({ where: { status: "PENDING", user: { company, ...teamFilter } } }),
    isSupervisor
      ? Promise.resolve(0)
      : prisma.documentRequest.count({ where: { status: "PENDING", user: { company } } }),
    prisma.salaryAdvance.count({ where: { status: "PENDING", user: { company, ...teamFilter } } }),
    // Distinct requests, not days: the queue shows one row per submission, so
    // a badge counting the eight Tuesdays inside it would not match what the
    // reviewer actually has to action.
    prisma.remoteWorkDay
      .findMany({
        where: { status: "PENDING", user: { company, ...teamFilter } },
        select: { requestId: true, id: true },
      })
      .then((rows) => new Set(rows.map((r) => r.requestId ?? r.id)).size),
  ]);

  const counts: Record<string, number> = {};
  if (conges) counts["/conges"] = conges;
  if (documents) counts["/documents"] = documents;
  if (paie) counts["/paie"] = paie;
  if (teletravail) counts["/teletravail"] = teletravail;
  return counts;
}

export type PendingSummaryItem = {
  key: "conges" | "documents" | "paie" | "teletravail";
  label: string;
  href: string;
  count: number;
  /** createdAt of the longest-waiting request in the category. */
  oldest: Date;
};

/**
 * Per-category breakdown of what awaits the viewer, for the dashboard "À
 * traiter" card. Same scoping and role guard as getPendingCounts (so the card
 * and the sidebar badges never disagree), plus the age of the oldest request.
 * Categories with nothing pending are omitted.
 */
export async function getPendingSummary(
  role: string,
  userId: string,
  company: string,
): Promise<PendingSummaryItem[]> {
  if (role !== "MANAGER" && role !== "ADMIN" && role !== "SUPERVISEUR") return [];
  const isSupervisor = role === "SUPERVISEUR";
  const teamFilter = isSupervisor ? { managerId: userId } : {};

  const [leaves, documents, advances, remoteDays] = await Promise.all([
    prisma.leaveRequest.aggregate({
      where: { status: "PENDING", user: { company, ...teamFilter } },
      _count: true,
      _min: { createdAt: true },
    }),
    isSupervisor
      ? Promise.resolve(null)
      : prisma.documentRequest.aggregate({
          where: { status: "PENDING", user: { company } },
          _count: true,
          _min: { createdAt: true },
        }),
    prisma.salaryAdvance.aggregate({
      where: { status: "PENDING", user: { company, ...teamFilter } },
      _count: true,
      _min: { createdAt: true },
    }),
    prisma.remoteWorkDay.findMany({
      where: { status: "PENDING", user: { company, ...teamFilter } },
      select: { id: true, requestId: true, createdAt: true },
    }),
  ]);

  // Remote days are one row each; collapse them to one entry per submission so
  // the count matches the queue (see getPendingCounts).
  const remoteRequests = new Map<string, Date>();
  for (const day of remoteDays) {
    const key = day.requestId ?? day.id;
    const seen = remoteRequests.get(key);
    if (!seen || day.createdAt < seen) remoteRequests.set(key, day.createdAt);
  }
  const remoteOldest = [...remoteRequests.values()].sort((a, b) => a.getTime() - b.getTime())[0];

  const items: PendingSummaryItem[] = [];
  const push = (
    key: PendingSummaryItem["key"],
    label: string,
    href: string,
    count: number,
    oldest: Date | null | undefined,
  ) => {
    if (count > 0 && oldest) items.push({ key, label, href, count, oldest });
  };
  push("conges", "Demandes de congés", "/conges", leaves._count, leaves._min.createdAt);
  if (documents) {
    push("documents", "Demandes de documents", "/documents", documents._count, documents._min.createdAt);
  }
  push("paie", "Avances sur salaire", "/paie", advances._count, advances._min.createdAt);
  push("teletravail", "Télétravail à valider", "/teletravail", remoteRequests.size, remoteOldest);
  return items;
}

/**
 * Total pending demandes (leave + documents + advances) per company, keyed by
 * company code. Company-wide (not team-scoped) — for the Admin → Entreprises
 * overview across every company.
 */
export async function getCompanyPendingTotals(
  codes: string[],
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    codes.map(async (code) => {
      const [conges, documents, paie] = await Promise.all([
        prisma.leaveRequest.count({ where: { status: "PENDING", user: { company: code } } }),
        prisma.documentRequest.count({ where: { status: "PENDING", user: { company: code } } }),
        prisma.salaryAdvance.count({ where: { status: "PENDING", user: { company: code } } }),
      ]);
      return [code, conges + documents + paie] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Notify a leave/advance request's reviewers: every ADMIN and MANAGER of the
 * company (both review company-wide) plus the employee's own manager if that
 * happens to be a SUPERVISEUR (team-scoped, so not already in the company-wide
 * set).
 */
export async function notifyTeamReviewers(
  company: string,
  managerId: string | null | undefined,
  type: NotificationType,
  message: string,
  link: string,
): Promise<void> {
  const reviewers = await prisma.user.findMany({
    where: { company, role: { in: ["ADMIN", "MANAGER"] } },
    select: { id: true },
  });
  const recipients = new Set(reviewers.map((r) => r.id));
  if (managerId) recipients.add(managerId);
  if (recipients.size === 0) return;

  await prisma.notification.createMany({
    data: [...recipients].map((userId) => ({ userId, type, message, link })),
  });
  emailUsers([...recipients], type, message, link);
}

/**
 * Notify a request's reviewers when the queue is company-wide (documents):
 * every MANAGER and ADMIN of the company can review it.
 */
export async function notifyCompanyReviewers(
  company: string,
  type: NotificationType,
  message: string,
  link: string,
): Promise<void> {
  const reviewers = await prisma.user.findMany({
    where: { company, role: { in: ["MANAGER", "ADMIN"] } },
    select: { id: true },
  });
  if (reviewers.length === 0) return;

  await prisma.notification.createMany({
    data: reviewers.map((r) => ({ userId: r.id, type, message, link })),
  });
  emailUsers(reviewers.map((r) => r.id), type, message, link);
}

/** Notify a single user — used when a request they submitted gets reviewed. */
export async function notifyUser(
  userId: string,
  type: NotificationType,
  message: string,
  link: string,
): Promise<void> {
  await prisma.notification.create({ data: { userId, type, message, link } });
  emailUsers([userId], type, message, link);
}

// ── E-mail ───────────────────────────────────────────────────────────────────
// Every notification is also mailed to its recipients. Sending is direct and
// best-effort: it is fired without being awaited and every failure is caught,
// so a mail outage can never slow down or fail an approval, a submission or an
// upload. No retry — a failed mail is only logged; the in-app notification
// above is already stored either way.

const EMAIL_SUBJECTS: Record<NotificationType, string> = {
  LEAVE_SUBMITTED: "Nouvelle demande de congé",
  LEAVE_REVIEWED: "Votre demande de congé a été traitée",
  ADVANCE_SUBMITTED: "Nouvelle demande d'avance sur salaire",
  ADVANCE_REVIEWED: "Votre demande d'avance a été traitée",
  DOCUMENT_SUBMITTED: "Nouvelle demande de document",
  DOCUMENT_REVIEWED: "Votre demande de document a été traitée",
  REMOTE_ASSIGNED: "Télétravail planifié",
  REMOTE_CANCELLED: "Télétravail annulé",
  REMOTE_SUBMITTED: "Nouvelle demande de télétravail",
  REMOTE_REVIEWED: "Votre demande de télétravail a été traitée",
  VAULT_DOCUMENT_ADDED: "Nouveau document dans votre coffre-fort",
};

/** Absolute URL for an in-app link, so it works from a mail client. */
function absoluteUrl(link: string): string {
  const base = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${link.startsWith("/") ? link : `/${link}`}`;
}

function emailUsers(
  userIds: string[],
  type: NotificationType,
  message: string,
  link: string | null,
): void {
  if (userIds.length === 0 || !isMailConfigured()) return;

  void (async () => {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { email: true, name: true },
    });
    const subject = `Fair'Up OS — ${EMAIL_SUBJECTS[type] ?? "Notification"}`;
    const results = await Promise.allSettled(
      users.map((u) =>
        sendNotificationEmail({
          to: u.email,
          name: u.name,
          subject,
          message,
          url: absoluteUrl(link ?? "/dashboard"),
        }),
      ),
    );
    results.forEach((res, i) => {
      if (res.status === "rejected") {
        console.error(`[mail] échec d'envoi à ${users[i].email} (${type}):`, res.reason);
      }
    });
  })().catch((err) => console.error("[mail] erreur d'envoi des notifications:", err));
}

export type NotificationItem = {
  id: string;
  type: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: Date;
};

/** Last 20 notifications for the bell dropdown, newest first, plus unread count. */
export async function getNotifications(
  userId: string,
): Promise<{ items: NotificationItem[]; unreadCount: number }> {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);
  return { items, unreadCount };
}

export type PendingReminder = {
  id: string;
  label: string; // e.g. "Congé — Marie D."
  age: string; // e.g. "il y a 3 jours"
  link: string;
};

/**
 * Currently-pending items scoped exactly like getPendingCounts, oldest first —
 * a "still waiting" nudge for reviewers, computed live (no persisted rows, no
 * cron). Returns [] for EMPLOYEE, same guard as getPendingCounts. SUPERVISEUR
 * gets no document reminders — they don't review document requests.
 */
export async function getPendingReminders(
  role: string,
  userId: string,
  company: string,
): Promise<PendingReminder[]> {
  if (role !== "MANAGER" && role !== "ADMIN" && role !== "SUPERVISEUR") return [];
  const isSupervisor = role === "SUPERVISEUR";
  const teamFilter = isSupervisor ? { managerId: userId } : {};

  const [leaves, documents, advances] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { status: "PENDING", user: { company, ...teamFilter } },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true } } },
    }),
    isSupervisor
      ? Promise.resolve([])
      : prisma.documentRequest.findMany({
          where: { status: "PENDING", user: { company } },
          orderBy: { createdAt: "asc" },
          include: { user: { select: { name: true } } },
        }),
    prisma.salaryAdvance.findMany({
      where: { status: "PENDING", user: { company, ...teamFilter } },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true } } },
    }),
  ]);

  const combined = [
    ...leaves.map((r) => ({ id: r.id, label: "Congé", name: r.user.name, createdAt: r.createdAt, link: "/conges" })),
    ...documents.map((r) => ({ id: r.id, label: "Document", name: r.user.name, createdAt: r.createdAt, link: "/documents" })),
    ...advances.map((r) => ({ id: r.id, label: "Avance", name: r.user.name, createdAt: r.createdAt, link: "/paie" })),
  ];
  combined.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return combined.map((r) => ({
    id: r.id,
    label: `${r.label} — ${r.name}`,
    age: `il y a ${formatDistanceToNow(r.createdAt, { locale: fr })}`,
    link: r.link,
  }));
}
