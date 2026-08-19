"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { notifyTeamReviewers, notifyUser } from "@/lib/notifications";

type Result = { success: true } | { error: string };

export async function submitAdvance(formData: FormData): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };

  const amount = parseFloat(formData.get("amount") as string);
  const reason = (formData.get("reason") as string)?.trim() || null;
  const repaymentMonth = (formData.get("repaymentMonth") as string)?.trim() || null;

  if (isNaN(amount) || amount <= 0) return { error: "Le montant doit être supérieur à 0." };

  // Block a new request while one is still pending.
  const pending = await prisma.salaryAdvance.count({
    where: { userId: session.user.id, status: "PENDING" },
  });
  if (pending > 0) return { error: "Vous avez déjà une demande d'avance en attente." };

  await prisma.salaryAdvance.create({
    data: { userId: session.user.id, amount, reason, repaymentMonth, status: "PENDING" },
  });

  const requester = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, company: true, managerId: true },
  });
  if (requester) {
    await notifyTeamReviewers(
      requester.company,
      requester.managerId,
      "ADVANCE_SUBMITTED",
      `${requester.name} a soumis une demande d'avance sur salaire.`,
      "/paie",
    );
  }

  revalidatePath("/paie");
  return { success: true };
}

export async function reviewAdvance(
  id: string,
  decision: "APPROVED" | "REJECTED",
  reviewNote?: string,
): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };
  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN" && role !== "SUPERVISEUR")
    return { error: "Accès refusé." };
  if (!["APPROVED", "REJECTED"].includes(decision)) return { error: "Paramètres invalides." };

  const company = await getActiveCompany(role, session.user.company);
  const advance = await prisma.salaryAdvance.findUnique({
    where: { id },
    include: { user: { select: { managerId: true, company: true } } },
  });
  if (!advance) return { error: "Demande introuvable." };
  if (advance.user.company !== company) return { error: "Accès refusé." };
  // SUPERVISEUR stays team-scoped; MANAGER/ADMIN can review any request in the active company.
  if (role === "SUPERVISEUR" && advance.user.managerId !== session.user.id)
    return { error: "Accès refusé." };

  await prisma.salaryAdvance.update({
    where: { id },
    data: {
      status: decision,
      reviewedById: session.user.id,
      reviewNote: reviewNote ?? null,
      reviewedAt: new Date(),
    },
  });

  await notifyUser(
    advance.userId,
    "ADVANCE_REVIEWED",
    decision === "APPROVED"
      ? "Votre demande d'avance sur salaire a été validée."
      : "Votre demande d'avance sur salaire a été refusée.",
    "/paie",
  );

  revalidatePath("/paie");
  return { success: true };
}
