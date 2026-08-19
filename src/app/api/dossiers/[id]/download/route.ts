import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { canManageDossiers, canAccessDossier } from "@/lib/dossiers/access";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  if (!canManageDossiers(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const { id } = await params;
  const company = await getActiveCompany(session.user.role, session.user.company);

  const dossier = await prisma.employeeDossier.findUnique({
    where: { id },
    include: { user: { select: { managerId: true } } },
  });
  if (!dossier || !dossier.generatedPdfPath) {
    return NextResponse.json({ error: "PDF introuvable. Régénérez-le d'abord." }, { status: 404 });
  }

  const principal = { role: session.user.role, userId: session.user.id, company };
  if (!canAccessDossier(principal, dossier)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const filePath = path.join(process.cwd(), "uploads", "dossiers", dossier.generatedPdfPath);
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  }

  const fullName = [dossier.prenom, dossier.nom].filter(Boolean).join("-") || id;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="dossier-${fullName}.pdf"`,
    },
  });
}
