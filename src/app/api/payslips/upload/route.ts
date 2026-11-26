import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveBulletin } from "@/lib/payslips-storage";

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

  await saveBulletin({ userId, mois: month, pdfBytes: new Uint8Array(await file.arrayBuffer()) });

  return NextResponse.json({ success: true });
}
