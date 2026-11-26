import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { splitPayslips, type PayslipEmployee } from "@/lib/payslips";
import { formatMonth, monthKey, saveBulletin } from "@/lib/payslips-storage";

export const runtime = "nodejs";

const MAX_BYTES = 30 * 1024 * 1024; // 30 Mo
const MAX_PAGES = 500;

type Assigned = { page: number; userName: string; matricule: string | null; mois: string; matchedBy: string | null };
type Unassigned = { page: number; reason: string };
type Duplicate = { page: number; userName: string; mois: string; reason: string };
/** A page that will be saved if the admin confirms. */
type Planned = Assigned & { userId: string; bytes: Uint8Array };

/**
 * Bulk payslip upload, in two steps with the same file:
 *  - preview (default): says who each page belongs to. Nothing is saved or sent.
 *  - mode=confirm: saves and notifies, only if the result is still the one that
 *    was previewed (the `token` of the preview must be sent back).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const monthOverride = String(formData.get("month") ?? "").trim();
  const confirm = formData.get("mode") === "confirm";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Seuls les fichiers PDF sont acceptés." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux (30 Mo maximum)." }, { status: 413 });
  }
  const pdfBytes = new Uint8Array(await file.arrayBuffer());
  // The MIME type is client-supplied: check the file really is a PDF.
  if (String.fromCharCode(...pdfBytes.slice(0, 5)) !== "%PDF-") {
    return NextResponse.json({ error: "Ce fichier n'est pas un PDF valide." }, { status: 400 });
  }

  // Same scope as the single upload form: the active company, ADMIN accounts excluded.
  const company = await getActiveCompany(session.user.role, session.user.company);
  const users = await prisma.user.findMany({
    where: { role: { not: "ADMIN" }, company },
    select: {
      id: true,
      name: true,
      subjectDossiers: { select: { matricule: true } },
    },
  });
  const employees: PayslipEmployee[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    matricule: u.subjectDossiers.find((d) => d.matricule?.trim())?.matricule ?? null,
  }));

  let pages;
  try {
    pages = await splitPayslips(pdfBytes, employees);
  } catch (err) {
    console.error("[payslips/bulk] lecture du PDF impossible:", err);
    return NextResponse.json({ error: "Impossible de lire ce PDF (fichier corrompu ou protégé)." }, { status: 400 });
  }
  if (pages.length > MAX_PAGES) {
    return NextResponse.json({ error: `Trop de pages (${MAX_PAGES} maximum).` }, { status: 400 });
  }

  // Existing payslips of the candidates, to refuse a silent overwrite.
  const existing = new Set(
    (
      await prisma.payslip.findMany({
        where: { userId: { in: employees.map((e) => e.id) } },
        select: { userId: true, month: true },
      })
    ).map((p) => `${p.userId}|${monthKey(p.month)}`),
  );

  const planned: Planned[] = [];
  const unassigned: Unassigned[] = [];
  const duplicates: Duplicate[] = [];
  const inFile = new Map<string, number>(); // employee+month → first page that has it

  for (const p of pages) {
    if (!p.employee || !p.bytes) {
      unassigned.push({ page: p.page, reason: p.error ?? "aucun salarié reconnu" });
      continue;
    }
    const rawMonth = monthOverride || p.month;
    if (!rawMonth) {
      unassigned.push({ page: p.page, reason: `mois introuvable (${p.employee.name} reconnu) — renseignez le mois` });
      continue;
    }
    const mois = formatMonth(rawMonth);
    const { id: userId, name: userName } = p.employee;

    const key = `${userId}|${monthKey(mois)}`;
    const firstPage = inFile.get(key);
    if (existing.has(key) || firstPage !== undefined) {
      const reason = existing.has(key)
        ? "un bulletin existe déjà pour ce mois — non remplacé"
        : `même salarié et même mois que la page ${firstPage} — seule la page ${firstPage} est retenue`;
      duplicates.push({ page: p.page, userName, mois, reason });
      continue;
    }
    inFile.set(key, p.page);
    planned.push({
      page: p.page,
      userId,
      userName,
      matricule: p.employee.matricule ?? null,
      mois,
      matchedBy: p.matchedBy,
      bytes: p.bytes,
    });
  }

  // Fingerprint of what would be saved: file, company, and page → employee, month.
  const token = createHash("sha256")
    .update(pdfBytes)
    .update(JSON.stringify([company, planned.map((p) => [p.page, p.userId, p.mois])]))
    .digest("hex");

  const publicRow = ({ page, userName, matricule, mois, matchedBy }: Planned): Assigned => ({
    page,
    userName,
    matricule,
    mois,
    matchedBy,
  });

  if (!confirm) {
    return NextResponse.json({
      total: pages.length,
      assigned: planned.map(publicRow),
      unassigned,
      duplicates,
      token,
    });
  }

  if (formData.get("token") !== token) {
    return NextResponse.json(
      { error: "Les données ont changé depuis l'aperçu. Rien n'a été enregistré : relancez l'analyse." },
      { status: 409 },
    );
  }

  const assigned: Assigned[] = [];
  for (const p of planned) {
    try {
      await saveBulletin({ userId: p.userId, mois: p.mois, pdfBytes: p.bytes });
    } catch (err) {
      console.error(`[payslips/bulk] page ${p.page}:`, err);
      unassigned.push({ page: p.page, reason: `erreur d'enregistrement (${p.userName})` });
      continue;
    }
    assigned.push(publicRow(p));
  }

  return NextResponse.json({ total: pages.length, assigned, unassigned, duplicates });
}
