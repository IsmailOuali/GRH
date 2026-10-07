"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { parseSalariesCsv, normalizeName } from "@/lib/suivi/csv";

type Scope = { error: string } | { userId: string; role: string; company: string };

async function managerScope(): Promise<Scope> {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };
  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN" && role !== "SUPERVISEUR")
    return { error: "Accès refusé." };
  return {
    userId: session.user.id,
    role,
    company: await getActiveCompany(role, session.user.company),
  };
}

export type CommitResult =
  | { success: true; created: number; updated: number; linked: number }
  | { error: string };

/**
 * Applies a previously-previewed CSV. The file is re-parsed server-side rather
 * than trusting a payload built by the browser — the preview is a display, not
 * a source of truth.
 *
 * Existing employees are UPDATED in place (matched on company + nomComplet) so
 * re-importing a corrected sheet is safe and idempotent. Nothing is deleted:
 * an employee dropped from the sheet keeps their record and is marked by the
 * caller via "date de sortie" instead.
 */
export async function commitSuiviImport(formData: FormData): Promise<CommitResult> {
  const scope = await managerScope();
  if ("error" in scope) return { error: scope.error };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Aucun fichier fourni." };

  const text = Buffer.from(await file.arrayBuffer()).toString("utf-8");
  const { rows, errors } = parseSalariesCsv(text);
  if (rows.length === 0) return { error: errors[0] ?? "Fichier illisible." };

  const users = await prisma.user.findMany({
    where: { company: scope.company },
    select: { id: true, name: true },
  });
  const byName = new Map<string, string[]>();
  for (const u of users) {
    const key = normalizeName(u.name).toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), u.id]);
  }

  // An account can back only one tracked record (userId is @unique), so a name
  // already claimed by an earlier row must not be reassigned to a later one.
  const claimed = new Set(
    (
      await prisma.trackedEmployee.findMany({
        where: { company: scope.company, userId: { not: null } },
        select: { userId: true, nomComplet: true },
      })
    )
      .filter((t) => !rows.some((r) => r.nomComplet === t.nomComplet))
      .map((t) => t.userId as string),
  );

  let created = 0;
  let updated = 0;
  let linked = 0;
  const now = new Date();

  for (const r of rows) {
    const matches = byName.get(r.nomComplet.toLowerCase()) ?? [];
    const candidate = matches.length === 1 ? matches[0] : null;
    const userId = candidate && !claimed.has(candidate) ? candidate : null;
    if (userId) claimed.add(userId);

    const data = {
      externalId: r.externalId,
      nom: r.nom,
      prenom: r.prenom,
      poste: r.poste,
      dateEntree: r.dateEntree,
      soldeCongesN: r.soldeCongesN,
      repriseCongesPris: r.repriseCongesPris,
      repriseAbsences: r.repriseAbsences,
      repriseRetardsNb: r.repriseRetardsNb,
      repriseRetardsH: r.repriseRetardsH,
      importedAt: now,
      ...(userId ? { userId } : {}),
    };

    const existing = await prisma.trackedEmployee.findUnique({
      where: { company_nomComplet: { company: scope.company, nomComplet: r.nomComplet } },
      select: { id: true },
    });

    if (existing) {
      // dateSortie is intentionally absent from `data`: it is set in the app,
      // not in the sheet, so a re-import must never clear it.
      await prisma.trackedEmployee.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.trackedEmployee.create({
        data: { ...data, company: scope.company, nomComplet: r.nomComplet },
      });
      created++;
    }
    if (userId) linked++;
  }

  revalidatePath("/conges");
  return { success: true, created, updated, linked };
}

export async function setDateSortie(
  id: string,
  dateSortie: string,
): Promise<{ success: true } | { error: string }> {
  const scope = await managerScope();
  if ("error" in scope) return { error: scope.error };

  const row = await prisma.trackedEmployee.findUnique({
    where: { id },
    select: { company: true },
  });
  if (!row) return { error: "Salarié introuvable." };
  if (row.company !== scope.company) return { error: "Accès refusé." };

  const value = dateSortie.trim();
  if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: "Date invalide." };

  await prisma.trackedEmployee.update({
    where: { id },
    data: { dateSortie: value || null },
  });
  revalidatePath("/conges");
  return { success: true };
}

/** All the per-salarié fields the Suivi RH editor can change. Strings so the
 *  form can send raw input; the action parses and validates them. */
export type TrackedEmployeeEdit = {
  poste: string;
  dateEntree: string; // yyyy-mm-dd or ""
  dateSortie: string; // yyyy-mm-dd or ""
  soldeCongesN: string; // "" → null (affiche "—")
  congesPris: string;
  absences: string;
  retardsNb: string;
  retardsH: string;
};

/** "" → null. Rejects non-numbers and negatives. Accepts "14", "14,5", "14.5". */
function parseNum(raw: string): { ok: true; value: number | null } | { ok: false } {
  const str = (raw ?? "").replace(/ /g, " ").trim();
  if (!str) return { ok: true, value: null };
  const n = Number(str.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return { ok: false };
  return { ok: true, value: n };
}

/**
 * Edits one tracked salarié in place — the manual counterpart to a CSV import,
 * so a single wrong figure can be fixed without re-importing the whole sheet.
 * A later re-import still overwrites these values.
 */
export async function updateTrackedEmployee(
  id: string,
  input: TrackedEmployeeEdit,
): Promise<{ success: true } | { error: string }> {
  const scope = await managerScope();
  if ("error" in scope) return { error: scope.error };

  const row = await prisma.trackedEmployee.findUnique({
    where: { id },
    select: { company: true },
  });
  if (!row) return { error: "Salarié introuvable." };
  if (row.company !== scope.company) return { error: "Accès refusé." };

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const dateEntree = input.dateEntree.trim();
  const dateSortie = input.dateSortie.trim();
  if (dateEntree && !dateRe.test(dateEntree)) return { error: "Date d'entrée invalide." };
  if (dateSortie && !dateRe.test(dateSortie)) return { error: "Date de sortie invalide." };

  const soldeN = parseNum(input.soldeCongesN);
  const pris = parseNum(input.congesPris);
  const abs = parseNum(input.absences);
  const retNb = parseNum(input.retardsNb);
  const retH = parseNum(input.retardsH);
  if (!soldeN.ok) return { error: "Solde congés N invalide." };
  if (!pris.ok) return { error: "Congés pris invalide." };
  if (!abs.ok) return { error: "Absences invalides." };
  if (!retNb.ok) return { error: "Retards (nb) invalides." };
  if (!retH.ok) return { error: "Retards (h) invalides." };

  await prisma.trackedEmployee.update({
    where: { id },
    data: {
      poste: input.poste.trim() || null,
      dateEntree: dateEntree || null,
      dateSortie: dateSortie || null,
      soldeCongesN: soldeN.value,
      repriseCongesPris: pris.value ?? 0,
      repriseAbsences: abs.value ?? 0,
      repriseRetardsNb: Math.trunc(retNb.value ?? 0),
      repriseRetardsH: retH.value ?? 0,
    },
  });
  revalidatePath("/conges");
  return { success: true };
}

export async function deleteTrackedEmployee(
  id: string,
): Promise<{ success: true } | { error: string }> {
  const scope = await managerScope();
  if ("error" in scope) return { error: scope.error };

  const row = await prisma.trackedEmployee.findUnique({
    where: { id },
    select: { company: true },
  });
  if (!row) return { error: "Salarié introuvable." };
  if (row.company !== scope.company) return { error: "Accès refusé." };

  await prisma.trackedEmployee.delete({ where: { id } });
  revalidatePath("/conges");
  return { success: true };
}
