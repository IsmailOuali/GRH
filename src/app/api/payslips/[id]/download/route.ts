import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { id } = await params;
  const payslip = await prisma.payslip.findUnique({ where: { id } });
  if (!payslip || !payslip.pdfPath) {
    return NextResponse.json({ error: "Bulletin introuvable." }, { status: 404 });
  }

  const role = session.user.role;
  const isManager = role === "MANAGER" || role === "ADMIN";
  if (!isManager && payslip.userId !== session.user.id) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const filePath = path.join(process.cwd(), "uploads", "payslips", payslip.pdfPath);
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="bulletin-${payslip.month}.pdf"`,
    },
  });
}
