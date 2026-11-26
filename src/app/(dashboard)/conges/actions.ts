"use server";

import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { getAidDates } from "@/lib/aid-server";
import { generateCongePayesPdf } from "@/lib/leave-pdf";
import { changeBalance } from "@/lib/leave-ledger";
import { accrueLeaveBalance } from "@/lib/accrual";
import {
  countLeaveDays,
  cpDaysToDeduct,
  isSpecialLeave,
  isValidLeaveType,
  LEAVE_TYPE_LABELS,
  specialLeaveEntitlement,
} from "@/lib/leave-types";
import { MAX_COMMENT_LENGTH, validateEventDate, validateLeaveDates } from "@/lib/leave-validation";
import { notifyTeamReviewers, notifyUser } from "@/lib/notifications";

export async function submitLeaveRequest(formData: FormData) {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };

  // FormData values can be missing, or a File: only accept real strings, so a
  // missing date can never silently become 1970-01-01.
  const field = (name: string): string => {
    const v = formData.get(name);
    return typeof v === "string" ? v.trim() : "";
  };

  const type = field("type");
  const startRaw = field("startDate");
  const endRaw = field("endDate");
  const comment = field("comment").slice(0, MAX_COMMENT_LENGTH) || undefined;

  if (!type || !startRaw || !endRaw) return { error: "Champs obligatoires manquants." };
  if (!isValidLeaveType(type)) return { error: "Type de congé invalide." };

  const startDate = new Date(startRaw);
  const endDate = new Date(endRaw);
  // Must run BEFORE counting days: the counting loops walk every day of the range.
  const dateError = validateLeaveDates(startDate, endDate);
  if (dateError) return { error: dateError };

  const days = countLeaveDays(type, startDate, endDate, await getAidDates());
  if (days === 0) return { error: "La période ne contient aucun jour ouvré." };

  const userId = session.user.id;

  // Never two live requests on the same days: they would be deducted twice.
  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      userId,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { type: true, startDate: true, endDate: true, status: true },
  });
  if (overlap) {
    return {
      error: `Vous avez déjà une demande ${overlap.status === "PENDING" ? "en attente" : "validée"} (${LEAVE_TYPE_LABELS[overlap.type] ?? overlap.type}) du ${format(overlap.startDate, "dd/MM/yyyy")} au ${format(overlap.endDate, "dd/MM/yyyy")} qui chevauche cette période.`,
    };
  }

  // Congé spécial: capped per EVENT. The event date identifies the event, so a
  // second request for the same marriage/décès counts against the same droit.
  let eventDate: Date | undefined;
  let usedForEvent = 0;
  if (isSpecialLeave(type)) {
    eventDate = new Date(field("eventDate"));
    const eventError = validateEventDate(eventDate, startDate, endDate);
    if (eventError) return { error: eventError };

    const droit = specialLeaveEntitlement(type)!;
    const already = await prisma.leaveRequest.aggregate({
      where: { userId, type, eventDate, status: { in: ["PENDING", "APPROVED"] } },
      _sum: { days: true },
    });
    const used = already._sum.days ?? 0;
    usedForEvent = used;
    if (used + days > droit) {
      return {
        error:
          used > 0
            ? `Droit maximum : ${droit} jour(s) pour cet événement (${used} déjà demandé(s), ${Math.max(0, droit - used)} restant(s)).`
            : `Droit maximum : ${droit} jour(s) pour cet événement.`,
      };
    }
  }

  // Jours taken from CP: all of them for CP; for the mariage du salarié only
  // what exceeds its 2 free jours.
  const cpDeducted = cpDaysToDeduct(type, days, usedForEvent);
  if (cpDeducted > 0) {
    // Credit any month(s) owed first, so the check runs against a current solde.
    await accrueLeaveBalance(userId);
    const balance = await prisma.leaveBalance.findUnique({ where: { userId } });
    const available = balance?.cpDays ?? 0;
    if (cpDeducted > available)
      return {
        error:
          type === "CP"
            ? `Solde CP insuffisant (${available} jour(s) disponible(s)).`
            : `Solde CP insuffisant : ${cpDeducted} jour(s) à prendre du CP, ${available} disponible(s).`,
      };
  }

  const created = await prisma.leaveRequest.create({
    data: { userId, type, startDate, endDate, days, cpDeducted, comment, eventDate, status: "PENDING" },
    select: { id: true },
  });

  const requester = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, company: true, managerId: true },
  });
  if (requester) {
    await notifyTeamReviewers(
      requester.company,
      requester.managerId,
      "LEAVE_SUBMITTED",
      `${requester.name} a soumis une demande de congé.`,
      "/conges",
    );
  }

  revalidatePath("/conges");
  revalidatePath("/dashboard");
  // The id lets the form attach an optional justificatif right after (the file
  // goes through the justificatif API route, not this action: actions cap the body at 1 MB).
  return { success: true, id: created.id };
}

export async function reviewLeave(formData: FormData) {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };
  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN" && role !== "SUPERVISEUR")
    return { error: "Accès refusé." };

  const id = formData.get("id") as string;
  const decision = formData.get("decision") as "APPROVED" | "REJECTED";
  const reviewNote = (formData.get("reviewNote") as string) || null;

  if (!id || !["APPROVED", "REJECTED"].includes(decision))
    return { error: "Paramètres invalides." };

  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!request) return { error: "Demande introuvable." };
  // A second validation would deduct the days a second time.
  if (request.status !== "PENDING") return { error: "Cette demande a déjà été traitée." };

  const company = await getActiveCompany(role, session.user.company);
  if (request.user.company !== company) return { error: "Accès refusé." };
  // SUPERVISEUR stays team-scoped; MANAGER/ADMIN can review any request in the active company.
  if (role === "SUPERVISEUR" && request.user.managerId !== session.user.id)
    return { error: "Accès refusé." };

  // The employee may not have opened the app in months — bring their solde
  // up to date before deducting, so the decrement lands on the right figure.
  const deducts = decision === "APPROVED" && request.cpDeducted > 0;
  if (deducts) await accrueLeaveBalance(request.userId);

  // Rendered first: if it fails, nothing has been deducted yet.
  let pdfPath: string | undefined;
  if (decision === "APPROVED" && request.type === "CP") {
    pdfPath = await generateCongePayesPdf(request);
  }

  const reviewed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.leaveRequest.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: decision,
        reviewedById: session.user.id,
        reviewNote,
        reviewedAt: new Date(),
        ...(pdfPath ? { pdfPath } : {}),
      },
    });
    if (count === 0) return false;
    if (deducts) {
      await changeBalance(tx, request.userId, -request.cpDeducted, {
        kind: "LEAVE",
        note: `${LEAVE_TYPE_LABELS[request.type] ?? request.type} du ${format(request.startDate, "dd/MM/yyyy")} au ${format(request.endDate, "dd/MM/yyyy")}`,
        leaveRequestId: id,
      });
    }
    return true;
  });
  if (!reviewed) return { error: "Cette demande a déjà été traitée." };

  await notifyUser(
    request.userId,
    "LEAVE_REVIEWED",
    decision === "APPROVED"
      ? "Votre demande de congé a été validée."
      : "Votre demande de congé a été refusée.",
    "/conges",
  );

  revalidatePath("/conges");
  revalidatePath("/dashboard");
  return { success: true };
}
