import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { extFromMime } from "@/lib/coffre-fort";
import { legalisationFilePath } from "@/lib/documents/legalisation-storage";

/**
 * Downloads an approved document. By default the generated PDF (for a
 * légalisation request this is the plain, non-légalisée copy). With
 * `?version=legalisee` it serves the scanned légalisée copy instead.
 */
export async function GET(
  req: NextRequest,
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

  if (req.nextUrl.searchParams.get("version") === "legalisee") {
    if (!docRequest.legaliseFile || !docRequest.legaliseAt) {
      return NextResponse.json({ error: "Version légalisée non disponible" }, { status: 404 });
    }
    const mime = docRequest.legaliseMime ?? "application/pdf";
    const buffer = fs.readFileSync(legalisationFilePath(docRequest.legaliseFile));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${docRequest.templateId}-legalisee.${extFromMime(mime) ?? "pdf"}"`,
      },
    });
  }

  const buffer = fs.readFileSync(docRequest.pdfPath);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${docRequest.templateId}.pdf"`,
    },
  });
}
