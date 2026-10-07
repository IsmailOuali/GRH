"use server";

import { unlink } from "fs/promises";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { vaultDocPath } from "@/lib/coffre-fort";

export type DeleteResult = { success: true } | { error: string };

/** Removes a native coffre-fort document. HR only, scoped to the active company. */
export async function deleteVaultDocument(id: string): Promise<DeleteResult> {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };

  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") return { error: "Accès refusé." };

  const doc = await prisma.vaultDocument.findUnique({ where: { id } });
  if (!doc) return { error: "Document introuvable." };

  const company = await getActiveCompany(role, session.user.company);
  if (doc.company !== company) return { error: "Accès refusé." };

  await prisma.vaultDocument.delete({ where: { id } });
  try {
    await unlink(vaultDocPath(doc.filename));
  } catch {
    // The row is gone; a missing file on disk is not worth surfacing.
  }

  revalidatePath("/coffre-fort");
  return { success: true };
}
