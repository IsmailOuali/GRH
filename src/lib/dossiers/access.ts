/**
 * Access control for Dossier Salarié — sensitive HR data (CIN, home address,
 * bank-doc checklist, emergency contact). ADMIN and MANAGER see every dossier
 * in the active company; SUPERVISEUR is scoped to their own team, consistent
 * with /conges and /paie.
 */

import type { Prisma } from "@prisma/client";

export function canManageDossiers(role: string | undefined): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "SUPERVISEUR";
}

interface Principal {
  role: string;
  userId: string;
  company: string;
}

/**
 * Prisma `where` for listing dossiers a principal may see.
 *  - ADMIN/MANAGER: every dossier in the active company.
 *  - SUPERVISEUR: dossiers in the company that they created OR whose linked
 *    employee is one of their direct reports.
 */
export function dossierListWhere(p: Principal): Prisma.EmployeeDossierWhereInput {
  if (p.role === "ADMIN" || p.role === "MANAGER") return { company: p.company };
  return {
    company: p.company,
    OR: [{ createdById: p.userId }, { user: { managerId: p.userId } }],
  };
}

/** Whether a principal may read/edit one already-loaded dossier. */
export function canAccessDossier(
  p: Principal,
  dossier: { company: string; createdById: string | null; user: { managerId: string | null } | null },
): boolean {
  if (dossier.company !== p.company) return false;
  if (p.role === "ADMIN" || p.role === "MANAGER") return true;
  return dossier.createdById === p.userId || dossier.user?.managerId === p.userId;
}
