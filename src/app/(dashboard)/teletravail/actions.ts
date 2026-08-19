"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { formatFrIso, toIso } from "@/lib/dates";
import { notifyUser } from "@/lib/notifications";
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
