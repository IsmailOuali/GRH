import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const docRequest = await prisma.documentRequest.findUnique({ where: { id } });

  if (!docRequest || docRequest.status !== "APPROVED" || !docRequest.pdfPath) {
    return NextResponse.json({ error: "Document non disponible" }, { status: 404 });
  }

  // Employees can only download their own documents
  if (
    session.user.role === "EMPLOYEE" &&
    docRequest.userId !== session.user.id
  ) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const buffer = fs.readFileSync(docRequest.pdfPath);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${docRequest.templateId}.pdf"`,
    },
  });
}
