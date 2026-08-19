import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const formData = await req.formData();
  const userId = formData.get("userId") as string;
  const month = (formData.get("month") as string)?.trim();
  const file = formData.get("file") as File | null;

  if (!userId || !month || !file) {
    return NextResponse.json({ error: "Champs obligatoires manquants." }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Seuls les fichiers PDF sont acceptés." }, { status: 400 });
  }

  const uploadsDir = path.join(process.cwd(), "uploads", "payslips");
  await mkdir(uploadsDir, { recursive: true });

  const filename = `${Date.now()}-${userId}.pdf`;
  const filePath = path.join(uploadsDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  await prisma.payslip.create({
    data: { userId, month, pdfPath: filename },
  });

  return NextResponse.json({ success: true });
}
