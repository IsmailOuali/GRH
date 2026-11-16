"use server";

import path from "path";
import fs from "fs";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { TEMPLATES_MAP } from "@/lib/documents/templates.config";
import { renderTemplate } from "@/lib/documents/render-template";
import { generatePdf } from "@/lib/documents/generate-pdf";
import { dossierToDocumentFields } from "@/lib/documents/dossier-prefill";
import { notifyCompanyReviewers, notifyUser } from "@/lib/notifications";

export async function submitDocumentRequest(
  templateId: string,
  fields: Record<string, string>,
  legalisation?: { legalise: boolean; reason?: string },
) {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };

  const template = TEMPLATES_MAP[templateId];
  if (!template) return { error: "Modèle introuvable." };

  const missing = template.fields
    .filter((f) => f.required && !f.readOnly && !fields[f.name]?.trim())
    .map((f) => f.label);
  if (missing.length > 0) return { error: `Champs manquants : ${missing.join(", ")}` };

  const legalise = legalisation?.legalise === true;
  const legaliseReason = legalise ? legalisation?.reason?.trim().slice(0, 300) || null : null;

  await prisma.documentRequest.create({
    data: {
      userId: session.user.id,
      templateId,
      fieldsJson: JSON.stringify(fields),
      legalise,
      legaliseReason,
    },
  });

  const requester = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, company: true },
  });
  if (requester) {
    await notifyCompanyReviewers(
      requester.company,
      "DOCUMENT_SUBMITTED",
      `${requester.name} a soumis une demande de document (${template.label}${legalise ? ", version légalisée" : ""}).`,
      "/documents",
    );
  }

  revalidatePath("/documents");
  return { success: true };
}

/**
 * Return document-form field values pre-filled from an employee's LINKED
 * dossier. Sensitive data (CIN/CNSS) is only ever returned to:
 *   - the employee themselves (their own dossier), or
 *   - a manager/admin, scoped to their active company.
 * Returns {} when there is no linked dossier or access isn't allowed.
 */
export async function getDossierPrefill(userId: string): Promise<Record<string, string>> {
  const session = await auth();
  if (!session?.user) return {};

  const isManager = session.user.role === "MANAGER" || session.user.role === "ADMIN";
  if (!isManager && userId !== session.user.id) return {};

  const company = await getActiveCompany(session.user.role, session.user.company);
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { company: true } });
  if (!target || target.company !== company) return {};

  const dossier = await prisma.employeeDossier.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      numeroCin: true,
      numeroCnss: true,
      poste: true,
      dateIntegration: true,
      typeContrat: true,
    },
  });
  if (!dossier) return {};

  return dossierToDocumentFields(dossier);
}

export async function reviewDocumentRequest(
  id: string,
  decision: "APPROVED" | "REJECTED",
  reviewNote?: string,
) {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return { error: "Accès refusé." };
  }

  const docRequest = await prisma.documentRequest.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!docRequest) return { error: "Demande introuvable." };

  let pdfPath: string | undefined;

  if (decision === "APPROVED") {
    const template = TEMPLATES_MAP[docRequest.templateId];
    if (!template) return { error: "Modèle introuvable." };

    const fields = JSON.parse(docRequest.fieldsJson) as Record<string, string>;

    // Format date fields dd/mm/yyyy
    for (const field of template.fields) {
      if (field.type === "date" && fields[field.name]) {
        const [y, m, d] = fields[field.name].split("-");
        if (y && m && d) fields[field.name] = `${d}/${m}/${y}`;
      }
    }

    const templatePath = path.join(process.cwd(), template.templatePath);
    const templateDir = path.dirname(templatePath);
    const html = fs.readFileSync(templatePath, "utf-8");
    const rendered = renderTemplate(html, fields);
    const pdf = await generatePdf(rendered, templateDir);

    const dir = path.join(process.cwd(), "uploads", "documents");
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${id}-${docRequest.templateId}.pdf`;
    pdfPath = path.join(dir, filename);
    fs.writeFileSync(pdfPath, pdf);
  }

  await prisma.documentRequest.update({
    where: { id },
    data: {
      status: decision,
      reviewedById: session.user.id,
      reviewNote: reviewNote ?? null,
      reviewedAt: new Date(),
      ...(pdfPath ? { pdfPath } : {}),
    },
  });

  await notifyUser(
    docRequest.userId,
    "DOCUMENT_REVIEWED",
    decision === "APPROVED"
      ? docRequest.legalise
        ? "Votre demande de document a été validée. La légalisation est en cours."
        : "Votre demande de document a été validée."
      : "Votre demande de document a été refusée.",
    "/documents",
  );

  revalidatePath("/documents");
  return { success: true };
}

/**
 * Closes a légalisation without a scan: the légalisée copy was handed to the
 * employee in person. (The scan path is the upload route,
 * /api/documents/[id]/legalise.)
 */
export async function markLegalisationDelivered(id: string, note?: string) {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };
  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") return { error: "Accès refusé." };

  const docRequest = await prisma.documentRequest.findUnique({
    where: { id },
    include: { user: { select: { company: true } } },
  });
  if (!docRequest) return { error: "Demande introuvable." };

  const company = await getActiveCompany(role, session.user.company);
  if (docRequest.user.company !== company) return { error: "Accès refusé." };
  if (docRequest.status !== "APPROVED" || !docRequest.legalise)
    return { error: "Cette demande n'a pas de légalisation à clôturer." };
  if (docRequest.legaliseAt) return { error: "Légalisation déjà clôturée." };

  await prisma.documentRequest.update({
    where: { id },
    data: {
      legaliseDelivery: "MAIN_PROPRE",
      legaliseAt: new Date(),
      legaliseNote: note?.trim().slice(0, 300) || null,
    },
  });

  await notifyUser(
    docRequest.userId,
    "DOCUMENT_REVIEWED",
    "Votre attestation légalisée est prête : elle vous sera remise en main propre par les RH.",
    "/documents",
  );

  revalidatePath("/documents");
  return { success: true };
}
