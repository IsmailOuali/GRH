"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addDays, buildAids, FEAST_LABELS, MAX_AID_SHIFT_DAYS, type Feast } from "@/lib/aid";
import { getAids } from "@/lib/aid-server";
import { leavesAround, recalculateLeaves } from "@/lib/aid-recalc";
import { generateCongePayesPdf } from "@/lib/leave-pdf";
import { formatFrIso, parseLocalDate, toIso } from "@/lib/dates";
import { notifyUser } from "@/lib/notifications";

/**
 * Sets the real first day of an Aïd. Applies to every company: recounts the
 * leave requests concerned and tells everyone the dates.
 */
export async function confirmAid(formData: FormData) {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };
  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") return { error: "Accès refusé." };

  const feast = String(formData.get("feast")) as Feast;
  const hijriYear = Number(formData.get("hijriYear"));
  const startDate = String(formData.get("startDate"));

  const aid = (await getAids()).find((a) => a.feast === feast && a.hijriYear === hijriYear);
  if (!aid) return { error: "Aïd introuvable." };

  const parsed = parseLocalDate(startDate);
  if (!parsed || toIso(parsed) !== startDate) return { error: "Date invalide." };
  if (
    startDate < addDays(aid.estimatedStart, -MAX_AID_SHIFT_DAYS) ||
    startDate > addDays(aid.estimatedStart, MAX_AID_SHIFT_DAYS)
  )
    return {
      error: `La date doit être à ${MAX_AID_SHIFT_DAYS} jours au plus de l'estimation (${formatFrIso(aid.estimatedStart)}).`,
    };
  if (aid.confirmed && aid.start === startDate) return { error: "Cette date est déjà confirmée." };

  const newDays = [startDate, addDays(startDate, 1)];
  const affected = [...aid.days, ...newDays];

  const changed = await prisma.$transaction(async (tx) => {
    await tx.aidConfirmation.upsert({
      where: { feast_hijriYear: { feast, hijriYear } },
      create: { feast, hijriYear, startDate, confirmedById: session.user.id },
      update: { startDate, confirmedById: session.user.id, confirmedAt: new Date() },
    });
    const year = new Date().getFullYear();
    const aids = buildAids(year - 2, year + 3, await tx.aidConfirmation.findMany());
    return recalculateLeaves(tx, affected, new Set(aids.flatMap((a) => a.days)));
  });

  // The attestations already issued show the day count and the date de reprise.
  // Done after the transaction: a PDF failure must not undo the recount.
  const toReissue = await prisma.leaveRequest.findMany({
    where: { ...leavesAround(affected), status: "APPROVED", type: "CP", pdfPath: { not: null } },
    include: { user: { select: { name: true } } },
  });
  let pdfFailures = 0;
  for (const request of toReissue) {
    try {
      await generateCongePayesPdf(request);
    } catch (err) {
      pdfFailures++;
      console.error(`[aid] attestation non régénérée pour la demande ${request.id}:`, err);
    }
  }

  const message = `${FEAST_LABELS[feast]} confirmé : ${formatFrIso(newDays[0])} et ${formatFrIso(newDays[1])}.`;
  const recounted = new Set(changed.filter((c) => c.delta !== 0).map((c) => c.userId));
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const u of users) {
    await notifyUser(
      u.id,
      "AID_CONFIRMED",
      recounted.has(u.id) ? `${message} Votre demande de congé a été recalculée.` : message,
      "/conges",
    );
  }

  revalidatePath("/", "layout");
  return { success: true, recalculated: changed.length, pdfFailures };
}
