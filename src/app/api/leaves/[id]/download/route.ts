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
  const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });

  if (!leaveRequest || leaveRequest.status !== "APPROVED" || !leaveRequest.pdfPath) {
    return NextResponse.json({ error: "Document non disponible" }, { status: 404 });
  }

  // Employees can only download their own leave request's attestation
  if (
    session.user.role === "EMPLOYEE" &&
    leaveRequest.userId !== session.user.id
  ) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const buffer = fs.readFileSync(leaveRequest.pdfPath);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="conge-payes.pdf"`,
    },
  });
}
