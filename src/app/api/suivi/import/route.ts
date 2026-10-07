import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { parseSalariesCsv, normalizeName, type SalarieRow } from "@/lib/suivi/csv";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — the sheet is a few KB

function canManage(role: string) {
  return role === "MANAGER" || role === "ADMIN" || role === "SUPERVISEUR";
}

export type ImportPreviewRow = SalarieRow & {
  action: "create" | "update";
  /** Name of the app account this row will be linked to, if any. */
  linkedTo: string | null;
  linkNote: string | null;
};

export type ImportPreview = {
  rows: ImportPreviewRow[];
  errors: string[];
  counts: { create: number; update: number; linked: number; warnings: number };
};

/**
 * Parses an uploaded "Salariés" CSV and reports exactly what an import would
 * do. Writes nothing — the caller confirms, then calls commitSuiviImport.
 * A preview that could mutate would defeat the point of having one.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  if (!canManage(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Le fichier doit faire entre 1 octet et 2 Mo." }, { status: 400 });
  }
  if (!/\.csv$/i.test(file.name)) {
    return NextResponse.json({ error: "Seuls les fichiers .csv sont acceptés." }, { status: 400 });
  }

  const text = Buffer.from(await file.arrayBuffer()).toString("utf-8");
  const { rows, errors } = parseSalariesCsv(text);
  if (rows.length === 0) {
    return NextResponse.json({ rows: [], errors, counts: { create: 0, update: 0, linked: 0, warnings: 0 } });
  }

  const company = await getActiveCompany(session.user.role, session.user.company);

  const [existing, users] = await Promise.all([
    prisma.trackedEmployee.findMany({
      where: { company },
      select: { nomComplet: true },
    }),
    prisma.user.findMany({
      where: { company },
      select: { id: true, name: true },
    }),
  ]);

  const known = new Set(existing.map((e) => e.nomComplet.toLowerCase()));

  // Match on normalised full name. Anything ambiguous is left unlinked and
  // reported, rather than guessing which of two people a row refers to.
  const byName = new Map<string, { id: string; name: string }[]>();
  for (const u of users) {
    const key = normalizeName(u.name).toLowerCase();
    const bucket = byName.get(key);
    if (bucket) bucket.push(u);
    else byName.set(key, [u]);
  }

  const preview: ImportPreviewRow[] = rows.map((r) => {
    const matches = byName.get(r.nomComplet.toLowerCase()) ?? [];
    let linkedTo: string | null = null;
    let linkNote: string | null = null;
    if (matches.length === 1) linkedTo = matches[0].name;
    else if (matches.length > 1) linkNote = `${matches.length} comptes portent ce nom — non lié`;

    return {
      ...r,
      action: known.has(r.nomComplet.toLowerCase()) ? "update" : "create",
      linkedTo,
      linkNote,
    };
  });

  const body: ImportPreview = {
    rows: preview,
    errors,
    counts: {
      create: preview.filter((r) => r.action === "create").length,
      update: preview.filter((r) => r.action === "update").length,
      linked: preview.filter((r) => r.linkedTo).length,
      warnings: preview.filter((r) => r.warnings.length > 0 || r.linkNote).length,
    },
  };
  return NextResponse.json(body);
}
