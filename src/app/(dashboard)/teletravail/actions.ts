"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { formatFrIso, toIso } from "@/lib/dates";
import { notifyTeamReviewers, notifyUser } from "@/lib/notifications";
import { expandRemoteDays, MAX_SPAN_DAYS } from "@/lib/teletravail";

const PLANNERS = ["MANAGER", "ADMIN", "SUPERVISEUR"];

export type AssignResult =
  | { success: true; created: number; skippedExisting: number; skippedLeave: number }
  | { error: string };

type PlannerScope =
  | { error: string }
  | {
      userId: string;
      role: string;
      company: string;
      /** Prisma `where` selecting exactly the employees this planner may touch. */
      where: { company: string; managerId?: string };
    };

/**
 * The employees the signed-in planner may assign télétravail to — the same
 * scoping the congés queue uses: MANAGER/ADMIN cover the whole active company,
 * a SUPERVISEUR only their own team.
 *
 * The return type is written out rather than inferred: TypeScript normalises a
 * union of object literals by adding `error?: undefined` to the other members,
 * which would defeat the `"error" in scope` narrowing at every call site.
 */
async function plannerScope(): Promise<PlannerScope> {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." as const };

  const role = session.user.role;
  if (!PLANNERS.includes(role)) return { error: "Accès refusé." as const };

  const company = await getActiveCompany(role, session.user.company);
  return {
    userId: session.user.id,
    role,
    company,
    where: {
      company,
      ...(role === "SUPERVISEUR" ? { managerId: session.user.id } : {}),
    },
  };
}

export async function assignRemoteDays(formData: FormData): Promise<AssignResult> {
  const scope = await plannerScope();
  if ("error" in scope) return { error: scope.error };

  const userIds = formData.getAll("userIds").map(String).filter(Boolean);
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const weekdays = formData.getAll("weekdays").map(Number).filter((n) => !isNaN(n));
  const note = (String(formData.get("note") ?? "").trim() || null) as string | null;

  if (userIds.length === 0) return { error: "Sélectionnez au moins un salarié." };
  if (!startDate || !endDate) return { error: "Renseignez la période." };
  if (endDate < startDate)
    return { error: "La date de fin doit être après la date de début." };

  const dates = expandRemoteDays(startDate, endDate, weekdays);
  if (dates.length === 0)
    return {
      error: `Aucun jour ouvré ne correspond à cette période (maximum ${MAX_SPAN_DAYS} jours).`,
    };

  // Only employees inside the planner's scope — a forged userId in the POST
  // body is silently dropped here rather than trusted from the form.
  const targets = await prisma.user.findMany({
    where: { id: { in: userIds }, ...scope.where },
    select: { id: true, name: true },
  });
  if (targets.length === 0) return { error: "Salarié introuvable dans votre périmètre." };

  const targetIds = targets.map((t) => t.id);
  const first = dates[0];
  const last = dates[dates.length - 1];

  const [existing, approvedLeaves] = await Promise.all([
    // SQLite has no `skipDuplicates`, so the @@unique([userId, date]) rows are
    // filtered out up front instead of being caught as a constraint error.
    prisma.remoteWorkDay.findMany({
      where: { userId: { in: targetIds }, date: { gte: first, lte: last } },
      select: { userId: true, date: true },
    }),
    // A validated congé wins over télétravail: the salarié is off, not remote.
    prisma.leaveRequest.findMany({
      where: { userId: { in: targetIds }, status: "APPROVED" },
      select: { userId: true, startDate: true, endDate: true },
    }),
  ]);

  const taken = new Set(existing.map((r) => `${r.userId}|${r.date}`));
  const onLeave = new Set<string>();
  for (const leave of approvedLeaves) {
    const cur = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    while (cur <= end) {
      onLeave.add(`${leave.userId}|${toIso(cur)}`);
      cur.setDate(cur.getDate() + 1);
    }
  }

  let skippedExisting = 0;
  let skippedLeave = 0;
  const rows: { userId: string; date: string; note: string | null; createdById: string }[] = [];
  const createdPerUser = new Map<string, number>();

  for (const target of targets) {
    for (const date of dates) {
      const key = `${target.id}|${date}`;
      if (taken.has(key)) {
        skippedExisting++;
        continue;
      }
      if (onLeave.has(key)) {
        skippedLeave++;
        continue;
      }
      rows.push({ userId: target.id, date, note, createdById: scope.userId });
      createdPerUser.set(target.id, (createdPerUser.get(target.id) ?? 0) + 1);
    }
  }

  if (rows.length > 0) {
    await prisma.remoteWorkDay.createMany({ data: rows });

    await Promise.all(
      targets
        .filter((t) => createdPerUser.has(t.id))
        .map((t) => {
          const n = createdPerUser.get(t.id)!;
          return notifyUser(
            t.id,
            "REMOTE_ASSIGNED",
            `${n} jour${n > 1 ? "s" : ""} de télétravail planifié${n > 1 ? "s" : ""} pour vous.`,
            "/teletravail",
          );
        }),
    );

    revalidatePath("/teletravail");
    revalidatePath("/dashboard");
  }

  return { success: true, created: rows.length, skippedExisting, skippedLeave };
}

export async function deleteRemoteDay(id: string): Promise<{ success: true } | { error: string }> {
  const scope = await plannerScope();
  if ("error" in scope) return { error: scope.error };

  const day = await prisma.remoteWorkDay.findUnique({
    where: { id },
    include: { user: { select: { id: true, company: true, managerId: true } } },
  });
  if (!day) return { error: "Jour introuvable." };

  if (day.user.company !== scope.company) return { error: "Accès refusé." };
  if (scope.role === "SUPERVISEUR" && day.user.managerId !== scope.userId)
    return { error: "Accès refusé." };

  await prisma.remoteWorkDay.delete({ where: { id } });

  await notifyUser(
    day.userId,
    "REMOTE_CANCELLED",
    `Votre télétravail du ${formatFrIso(day.date)} a été annulé.`,
    "/teletravail",
  );

  revalidatePath("/teletravail");
  revalidatePath("/dashboard");
  return { success: true };
}

// ── Employee-initiated requests ──────────────────────────────────────────────

export type RequestResult =
  | { success: true; created: number; skippedExisting: number; skippedLeave: number }
  | { error: string };

/**
 * An employee asks for télétravail days for themselves. Days land as PENDING
 * and only become real once a manager validates them, so nobody can grant
 * themselves remote work.
 *
 * Always operates on the caller's own id — the form never carries a userId,
 * so there is nothing to forge.
 */
export async function requestRemoteDays(formData: FormData): Promise<RequestResult> {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };
  const userId = session.user.id;

  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const weekdays = formData.getAll("weekdays").map(Number).filter((n) => !isNaN(n));
  const note = (String(formData.get("note") ?? "").trim() || null) as string | null;

  if (!startDate || !endDate) return { error: "Renseignez la période." };
  if (endDate < startDate)
    return { error: "La date de fin doit être après la date de début." };

  const dates = expandRemoteDays(startDate, endDate, weekdays);
  if (dates.length === 0)
    return {
      error: `Aucun jour ouvré ne correspond à cette période (maximum ${MAX_SPAN_DAYS} jours).`,
    };

  const first = dates[0];
  const last = dates[dates.length - 1];

  const [existing, approvedLeaves] = await Promise.all([
    // Any status counts as taken: a day already pending must not be asked for
    // twice, and @@unique([userId, date]) would reject it anyway.
    prisma.remoteWorkDay.findMany({
      where: { userId, date: { gte: first, lte: last } },
      select: { date: true },
    }),
    prisma.leaveRequest.findMany({
      where: { userId, status: "APPROVED" },
      select: { startDate: true, endDate: true },
    }),
  ]);

  const taken = new Set(existing.map((r) => r.date));
  const onLeave = new Set<string>();
  for (const leave of approvedLeaves) {
    const cur = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    while (cur <= end) {
      onLeave.add(toIso(cur));
      cur.setDate(cur.getDate() + 1);
    }
  }

  let skippedExisting = 0;
  let skippedLeave = 0;
  const wanted: string[] = [];
  for (const date of dates) {
    if (taken.has(date)) skippedExisting++;
    else if (onLeave.has(date)) skippedLeave++;
    else wanted.push(date);
  }

  if (wanted.length === 0) {
    return { success: true, created: 0, skippedExisting, skippedLeave };
  }

  // One id for the whole submission, so the manager validates the request
  // rather than each Tuesday separately.
  const requestId = `req_${userId}_${Date.now()}`;

  await prisma.remoteWorkDay.createMany({
    data: wanted.map((date) => ({
      userId,
      date,
      note,
      status: "PENDING",
      requestId,
      createdById: userId,
    })),
  });

  const requester = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, company: true, managerId: true },
  });
  if (requester) {
    await notifyTeamReviewers(
      requester.company,
      requester.managerId,
      "REMOTE_SUBMITTED",
      `${requester.name} demande ${wanted.length} jour${wanted.length > 1 ? "s" : ""} de télétravail.`,
      "/teletravail",
    );
  }

  revalidatePath("/teletravail");
  revalidatePath("/dashboard");
  return { success: true, created: wanted.length, skippedExisting, skippedLeave };
}

/**
 * Validates or refuses a whole request.
 *
 * A refusal DELETES the days rather than marking them REJECTED: @@unique
 * ([userId, date]) means a kept rejected row would permanently block that date,
 * so the employee could never ask again. The outcome reaches them by
 * notification instead.
 */
export async function reviewRemoteRequest(
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  reviewNote?: string,
): Promise<{ success: true; days: number } | { error: string }> {
  const scope = await plannerScope();
  if ("error" in scope) return { error: scope.error };
  if (decision !== "APPROVED" && decision !== "REJECTED")
    return { error: "Décision invalide." };

  const days = await prisma.remoteWorkDay.findMany({
    where: { requestId, status: "PENDING" },
    include: { user: { select: { id: true, name: true, company: true, managerId: true } } },
  });
  if (days.length === 0) return { error: "Demande introuvable ou déjà traitée." };

  const target = days[0].user;
  if (target.company !== scope.company) return { error: "Accès refusé." };
  if (scope.role === "SUPERVISEUR" && target.managerId !== scope.userId)
    return { error: "Accès refusé." };

  if (decision === "APPROVED") {
    await prisma.remoteWorkDay.updateMany({
      where: { requestId, status: "PENDING" },
      data: {
        status: "APPROVED",
        reviewedById: scope.userId,
        reviewNote: reviewNote || null,
        reviewedAt: new Date(),
      },
    });
  } else {
    await prisma.remoteWorkDay.deleteMany({ where: { requestId, status: "PENDING" } });
  }

  await notifyUser(
    target.id,
    "REMOTE_REVIEWED",
    decision === "APPROVED"
      ? `Votre demande de télétravail (${days.length} jour${days.length > 1 ? "s" : ""}) a été validée.`
      : `Votre demande de télétravail (${days.length} jour${days.length > 1 ? "s" : ""}) a été refusée.`,
    "/teletravail",
  );

  revalidatePath("/teletravail");
  revalidatePath("/dashboard");
  return { success: true, days: days.length };
}
