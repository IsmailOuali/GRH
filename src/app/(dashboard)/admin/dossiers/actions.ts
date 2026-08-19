"use server";

import path from "path";
import { rm } from "fs/promises";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { canManageDossiers, canAccessDossier } from "@/lib/dossiers/access";
import { dataToColumns } from "@/lib/dossiers/serialize";
import { emptyDossierData, type DossierData } from "@/lib/dossiers/schema";

type SaveResult = { success: true } | { error: string };
type CreateResult = { success: true; id: string } | { error: string };
type DeleteResult = { success: true } | { error: string };

export async function saveDossier(
  id: string,
  data: DossierData,
  linkedUserId?: string | null,
): Promise<SaveResult> {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };
  if (!canManageDossiers(session.user.role)) return { error: "Accès refusé." };

  const company = await getActiveCompany(session.user.role, session.user.company);
  const existing = await prisma.employeeDossier.findUnique({
    where: { id },
    include: { user: { select: { managerId: true } } },
  });
  if (!existing) return { error: "Dossier introuvable." };

  const principal = { role: session.user.role, userId: session.user.id, company };
  if (!canAccessDossier(principal, existing)) return { error: "Accès refusé." };

  // Resolve the linked employee: undefined = leave unchanged, "" = unlink,
  // otherwise validate the account is in the same company.
  let userIdUpdate: { userId: string | null } | object = {};
  if (linkedUserId !== undefined) {
    if (linkedUserId) {
      const target = await prisma.user.findUnique({ where: { id: linkedUserId } });
      if (!target || target.company !== company) return { error: "Employé invalide." };
      userIdUpdate = { userId: linkedUserId };
    } else {
      userIdUpdate = { userId: null };
    }
  }

  const safe: DossierData = {
    ...emptyDossierData(),
    ...data,
    fields: { ...emptyDossierData().fields, ...(data.fields ?? {}) },
  };

  await prisma.employeeDossier.update({
    where: { id },
    data: { ...dataToColumns(safe), ...userIdUpdate, updatedById: session.user.id },
  });

  revalidatePath("/admin/dossiers");
  revalidatePath(`/admin/dossiers/${id}`);
  revalidatePath("/dashboard");
  return { success: true };
}

/** Create an empty dossier (from-scratch flow) and return its id. */
export async function createBlankDossier(): Promise<CreateResult> {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };
  if (!canManageDossiers(session.user.role)) return { error: "Accès refusé." };

  const company = await getActiveCompany(session.user.role, session.user.company);
  const dossier = await prisma.employeeDossier.create({
    data: {
      ...dataToColumns(emptyDossierData()),
      company,
      createdById: session.user.id,
      updatedById: session.user.id,
    },
    select: { id: true },
  });

  revalidatePath("/admin/dossiers");
  return { success: true, id: dossier.id };
}

/** Delete a dossier and its stored PDF files (source + generated). */
export async function deleteDossier(id: string): Promise<DeleteResult> {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };
  if (!canManageDossiers(session.user.role)) return { error: "Accès refusé." };

  const company = await getActiveCompany(session.user.role, session.user.company);
  const existing = await prisma.employeeDossier.findUnique({
    where: { id },
    include: { user: { select: { managerId: true } } },
  });
  if (!existing) return { error: "Dossier introuvable." };

  const principal = { role: session.user.role, userId: session.user.id, company };
  if (!canAccessDossier(principal, existing)) return { error: "Accès refusé." };

  await prisma.employeeDossier.delete({ where: { id } });

  // Best-effort cleanup of the uploaded + regenerated PDFs.
  const dir = path.join(process.cwd(), "uploads", "dossiers");
  for (const f of [existing.sourcePdfPath, existing.generatedPdfPath]) {
    if (f) await rm(path.join(dir, f)).catch(() => {});
  }

  revalidatePath("/admin/dossiers");
  return { success: true };
}
