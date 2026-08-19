import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { canManageDossiers, canAccessDossier } from "@/lib/dossiers/access";
import { dataToColumns, dossierToData } from "@/lib/dossiers/serialize";
import { renderDossierHtml } from "@/lib/dossiers/render-html";
import { generatePdf } from "@/lib/documents/generate-pdf";
import { emptyDossierData, type DossierData } from "@/lib/dossiers/schema";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  if (!canManageDossiers(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const { id } = await params;
  const company = await getActiveCompany(session.user.role, session.user.company);

  const existing = await prisma.employeeDossier.findUnique({
    where: { id },
    include: { user: { select: { managerId: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 });

  const principal = { role: session.user.role, userId: session.user.id, company };
  if (!canAccessDossier(principal, existing)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  // Current form state from the client (best-effort shape; sanitized below).
  const body = (await req.json().catch(() => ({}))) as Partial<DossierData>;
  const incoming: DossierData = {
    ...emptyDossierData(),
    ...body,
    fields: { ...emptyDossierData().fields, ...(body.fields ?? {}) },
  };

  // Sanitize → flatten, persist columns so stored data matches the PDF.
  const columns = dataToColumns(incoming);
  await prisma.employeeDossier.update({
    where: { id },
    data: { ...columns, updatedById: session.user.id },
  });

  // Re-derive clean data from the stored columns, then render + print.
  const data = dossierToData({ ...columns });
  const html = renderDossierHtml(data);
  const pdf = await generatePdf(html, process.cwd());

  const dir = path.join(process.cwd(), "uploads", "dossiers");
  await mkdir(dir, { recursive: true });
  const filename = `${id}-dossier.pdf`;
  await writeFile(path.join(dir, filename), pdf);

  await prisma.employeeDossier.update({
    where: { id },
    data: { generatedPdfPath: filename },
  });

  const fullName = [data.fields.prenom, data.fields.nom].filter(Boolean).join("-") || id;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="dossier-${fullName}.pdf"`,
    },
  });
}
