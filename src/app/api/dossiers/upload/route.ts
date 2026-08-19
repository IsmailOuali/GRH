import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { canManageDossiers } from "@/lib/dossiers/access";
import { extractDossierFromPdf } from "@/lib/dossiers/pdf";
import { dataToColumns } from "@/lib/dossiers/serialize";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  if (!canManageDossiers(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Seuls les fichiers PDF sont acceptés." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Le fichier doit faire entre 1 octet et 5 Mo." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Magic-byte check — a real PDF starts with "%PDF-", regardless of extension.
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return NextResponse.json({ error: "Le fichier n'est pas un PDF valide." }, { status: 400 });
  }

  let extracted;
  try {
    extracted = await extractDossierFromPdf(buffer);
  } catch {
    return NextResponse.json(
      { error: "Impossible de lire le PDF. Vérifiez qu'il n'est pas protégé." },
      { status: 422 },
    );
  }

  const company = await getActiveCompany(session.user.role, session.user.company);

  // Persist the original upload for audit.
  const dir = path.join(process.cwd(), "uploads", "dossiers");
  await mkdir(dir, { recursive: true });
  const sourceFilename = `${Date.now()}-source.pdf`;
  await writeFile(path.join(dir, sourceFilename), buffer);

  const columns = dataToColumns(extracted);
  const dossier = await prisma.employeeDossier.create({
    data: {
      ...columns,
      company,
      sourcePdfPath: sourceFilename,
      createdById: session.user.id,
      updatedById: session.user.id,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: dossier.id, unresolved: extracted.unresolved });
}
