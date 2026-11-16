import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { notifyUser } from "@/lib/notifications";
import { ACCEPTED_MIME_TYPES, extFromMime } from "@/lib/coffre-fort";
import { LEGALISATION_MAX_BYTES } from "@/lib/documents/legalisation";
import { legalisationDir, legalisationFilePath } from "@/lib/documents/legalisation-storage";

/**
 * Closes a légalisation with the scanned copy. Manager/admin only, scoped to
 * the active company. The employee then downloads it from Documents and finds
 * it in their coffre-fort.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const { id } = await params;
  const docRequest = await prisma.documentRequest.findUnique({
    where: { id },
    include: { user: { select: { company: true } } },
  });
  if (!docRequest) return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });

  const company = await getActiveCompany(role, session.user.company);
  if (docRequest.user.company !== company) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  if (docRequest.status !== "APPROVED" || !docRequest.legalise) {
    return NextResponse.json({ error: "Cette demande n'a pas de légalisation à clôturer." }, { status: 400 });
  }
  if (docRequest.legaliseAt) {
    return NextResponse.json({ error: "Légalisation déjà clôturée." }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const note = (formData.get("note") as string | null)?.trim().slice(0, 300) || null;

  if (!file) return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Type de fichier non accepté (PDF ou image)." }, { status: 400 });
  }
  if (file.size > LEGALISATION_MAX_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux (15 Mo max)." }, { status: 400 });
  }

  // Extension comes from the validated MIME type, never from the client's filename.
  const filename = `${id}-${Date.now()}.${extFromMime(file.type) ?? "pdf"}`;
  await mkdir(legalisationDir(), { recursive: true });
  await writeFile(legalisationFilePath(filename), Buffer.from(await file.arrayBuffer()));

  await prisma.documentRequest.update({
    where: { id },
    data: {
      legaliseDelivery: "SCAN",
      legaliseFile: filename,
      legaliseMime: file.type,
      legaliseNote: note,
      legaliseAt: new Date(),
    },
  });

  await notifyUser(
    docRequest.userId,
    "DOCUMENT_REVIEWED",
    "Votre attestation légalisée est disponible au téléchargement.",
    "/documents",
  );

  return NextResponse.json({ success: true });
}
