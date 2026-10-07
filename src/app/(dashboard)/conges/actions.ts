"use server";

import path from "path";
import fs from "fs";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { businessDaysBetween, nextBusinessDay } from "@/lib/dates";
import { accrueLeaveBalance } from "@/lib/accrual";
import { notifyTeamReviewers, notifyUser } from "@/lib/notifications";
import { TEMPLATES_MAP } from "@/lib/documents/templates.config";
import { renderTemplate } from "@/lib/documents/render-template";
import { generatePdf } from "@/lib/documents/generate-pdf";

/**
 * Renders the "Demande de congés payés" attestation for an approved CP
 * request — the same template Documents used to offer standalone, now
 * generated automatically instead of as a separate DocumentRequest.
 */
async function generateCongePayesPdf(request: {
  id: string;
  days: number;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  user: { name: string };
}): Promise<string> {
  const template = TEMPLATES_MAP["conge-payes"];
  const fields: Record<string, string> = {
    nom_salarie: request.user.name,
    date_demande: format(request.createdAt, "dd/MM/yyyy"),
    date_debut: format(request.startDate, "dd/MM/yyyy"),
    date_fin: format(request.endDate, "dd/MM/yyyy"),
    nombre_jours: String(request.days),
    date_reprise: format(nextBusinessDay(request.endDate), "dd/MM/yyyy"),
  };

  const templatePath = path.join(process.cwd(), template.templatePath);
  const templateDir = path.dirname(templatePath);
  const html = fs.readFileSync(templatePath, "utf-8");
  const rendered = renderTemplate(html, fields);
  const pdf = await generatePdf(rendered, templateDir);

  const dir = path.join(process.cwd(), "uploads", "leaves");
  fs.mkdirSync(dir, { recursive: true });
  const pdfPath = path.join(dir, `${request.id}-conge-payes.pdf`);
  fs.writeFileSync(pdfPath, pdf);
  return pdfPath;
}

export async function submitLeaveRequest(formData: FormData) {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };

  const type = formData.get("type") as string;
  const startDate = new Date(formData.get("startDate") as string);
  const endDate = new Date(formData.get("endDate") as string);
  const comment = (formData.get("comment") as string) || undefined;

  if (!type || isNaN(startDate.getTime()) || isNaN(endDate.getTime()))
    return { error: "Champs obligatoires manquants." };
  if (endDate < startDate)
    return { error: "La date de fin doit être après la date de début." };

  const days = businessDaysBetween(startDate, endDate);
  if (days === 0) return { error: "La période ne contient aucun jour ouvré." };

  const userId = session.user.id;

  if (type === "CP" || type === "RTT") {
    // Credit any month(s) owed first, so the check runs against a current solde.
    await accrueLeaveBalance(userId);
    const balance = await prisma.leaveBalance.findUnique({ where: { userId } });
    const available = type === "CP" ? (balance?.cpDays ?? 0) : (balance?.rttDays ?? 0);
    if (days > available)
      return { error: `Solde insuffisant (${available} jour(s) disponible(s)).` };
  }

  await prisma.leaveRequest.create({
    data: { userId, type, startDate, endDate, days, comment, status: "PENDING" },
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
  return { success: true };
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

  const company = await getActiveCompany(role, session.user.company);
  if (request.user.company !== company) return { error: "Accès refusé." };
  // SUPERVISEUR stays team-scoped; MANAGER/ADMIN can review any request in the active company.
  if (role === "SUPERVISEUR" && request.user.managerId !== session.user.id)
    return { error: "Accès refusé." };

  if (decision === "APPROVED" && (request.type === "CP" || request.type === "RTT")) {
    // The employee may not have opened the app in months — bring their solde
    // up to date before deducting, so the decrement lands on the right figure.
    await accrueLeaveBalance(request.userId);
    await prisma.leaveBalance.update({
      where: { userId: request.userId },
      data: request.type === "CP"
        ? { cpDays: { decrement: request.days } }
        : { rttDays: { decrement: request.days } },
    });
  }

  let pdfPath: string | undefined;
  if (decision === "APPROVED" && request.type === "CP") {
    pdfPath = await generateCongePayesPdf(request);
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: decision,
      reviewedById: session.user.id,
      reviewNote,
      reviewedAt: new Date(),
      ...(pdfPath ? { pdfPath } : {}),
    },
  });

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
