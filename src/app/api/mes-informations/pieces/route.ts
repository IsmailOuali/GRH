import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toIso } from "@/lib/dates";
import { notifyCompanyReviewers } from "@/lib/notifications";
import { ACCEPTED_MIME_TYPES, extFromMime } from "@/lib/coffre-fort";
import { dossierToData } from "@/lib/dossiers/serialize";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * A salarié files a pièce the RH is still waiting for (a row of their dossier's
 * checklist marked "En attente"). The file lands in their coffre-fort
 * (Pièces justificatives) and the checklist row becomes "Reçu" with today's
 * date; the RH is notified and can reopen the row if the file is not usable.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const userId = session.user.id;

  const formData = await req.formData();
  const pieceName = formData.get("piece");
  const file = formData.get("file");
  if (typeof pieceName !== "string" || !pieceName.trim() || !(file instanceof File)) {
    return NextResponse.json({ error: "Champs obligatoires manquants." }, { status: 400 });
  }
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Type de fichier non accepté (PDF ou image)." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Fichier vide ou trop volumineux (15 Mo max)." }, { status: 400 });
  }

  const [dossier, user] = await Promise.all([
    prisma.employeeDossier.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, company: true } }),
  ]);
  if (!dossier || !user) {
    return NextResponse.json({ error: "Votre fiche n'a pas encore été créée par les RH." }, { status: 404 });
  }

  // Only a row the RH is actually waiting for: a salarié cannot overwrite a
  // pièce that was already received and checked.
  const data = dossierToData(dossier as unknown as Record<string, unknown>);
  const target = data.pieces.find((p) => p.document === pieceName);
  if (!target) return NextResponse.json({ error: "Pièce inconnue." }, { status: 400 });
  if (target.statut !== "En attente") {
    return NextResponse.json({ error: "Cette pièce a déjà été reçue." }, { status: 400 });
  }

  // Extension comes from the validated MIME type, never from the client's filename.
  const filename = `${Date.now()}-${userId}.${extFromMime(file.type) ?? "pdf"}`;
  const dir = path.join(process.cwd(), "uploads", "coffre-fort");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));

  const pieces = data.pieces.map((p) =>
    p.document === pieceName ? { ...p, statut: "Reçu", dateReception: toIso(new Date()) } : p,
  );

  try {
    await prisma.$transaction([
      prisma.vaultDocument.create({
        data: {
          userId,
          company: user.company,
          category: "JUSTIFICATIF",
          title: pieceName,
          filename,
          mimeType: file.type,
          size: file.size,
          uploadedById: userId,
        },
      }),
      prisma.employeeDossier.update({
        where: { id: dossier.id },
        data: { pieces: JSON.stringify(pieces) },
      }),
    ]);
  } catch (err) {
    // Never leave an unreferenced file behind when the rows could not be saved.
    await unlink(path.join(dir, filename)).catch(() => {});
    console.error("pièce: enregistrement impossible", err);
    return NextResponse.json({ error: "Enregistrement impossible, réessayez." }, { status: 500 });
  }

  await notifyCompanyReviewers(
    user.company,
    "PIECE_UPLOADED",
    `${user.name} a déposé une pièce : ${pieceName}.`,
    `/coffre-fort?userId=${userId}`,
  );

  return NextResponse.json({ success: true });
}
