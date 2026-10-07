import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { notifyUser } from "@/lib/notifications";
import {
  ACCEPTED_MIME_TYPES,
  UPLOADABLE_CATEGORIES,
  type VaultCategory,
} from "@/lib/coffre-fort";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const formData = await req.formData();
  const userId = (formData.get("userId") as string)?.trim();
  const title = (formData.get("title") as string)?.trim();
  const category = (formData.get("category") as string)?.trim() as VaultCategory;
  const file = formData.get("file") as File | null;

  if (!userId || !title || !category || !file) {
    return NextResponse.json({ error: "Champs obligatoires manquants." }, { status: 400 });
  }
  if (!UPLOADABLE_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Catégorie invalide." }, { status: 400 });
  }
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Type de fichier non accepté (PDF ou image)." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux (15 Mo max)." }, { status: 400 });
  }

  // The target employee must belong to the active company (per-company scoping).
  const company = await getActiveCompany(role, session.user.company);
  const target = await prisma.user.findFirst({
    where: { id: userId, company },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Employé introuvable dans cet espace." }, { status: 404 });
  }

  const ext = path.extname(file.name).slice(0, 10) || ".pdf";
  const filename = `${Date.now()}-${userId}${ext}`;
  const uploadsDir = path.join(process.cwd(), "uploads", "coffre-fort");
  await mkdir(uploadsDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), buffer);

  await prisma.vaultDocument.create({
    data: {
      userId,
      company,
      category,
      title,
      filename,
      mimeType: file.type,
      size: file.size,
      uploadedById: session.user.id,
    },
  });

  await notifyUser(
    userId,
    "VAULT_DOCUMENT_ADDED",
    `Nouveau document dans votre coffre-fort : ${title}`,
    "/coffre-fort",
  );

  return NextResponse.json({ success: true });
}
