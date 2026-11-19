import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readFile, unlink } from "fs/promises";
import { format } from "date-fns";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { notifyTeamReviewers } from "@/lib/notifications";
import { ACCEPTED_MIME_TYPES, extFromMime } from "@/lib/coffre-fort";
import { JUSTIFICATIF_MAX_BYTES, canFileJustificatif } from "@/lib/leave-justificatif";
import { justificatifDir, justificatifFilePath } from "@/lib/leave-justificatif-storage";

/**
 * Justificatif d'absence of a leave request.
 *
 *  - POST: the EMPLOYEE who made the request files (or replaces) it, at any time
 *    — including long after the absence was declared. Notifies the reviewers.
 *  - GET: the owner, or a reviewer of that employee's company, downloads it.
 */

/**
 * Download name: justificatif_<nom_salarie>_<yyyyMMdd of the absence's first
 * day>, e.g. justificatif_thomas_petit_20261202.pdf. The name is reduced to
 * lowercase a-z/0-9 and underscores, so it is also safe inside the header.
 */
function downloadName(employeeName: string, startDate: Date, mime: string): string {
  const slug =
    employeeName
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "salarie";
  return `justificatif_${slug}_${format(startDate, "yyyyMMdd")}.${extFromMime(mime) ?? "pdf"}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { id } = await params;
  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { user: { select: { name: true, company: true, managerId: true } } },
  });
  // Someone else's request looks exactly like a missing one.
  if (!request || request.userId !== session.user.id) {
    return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
  }
  if (!canFileJustificatif(request)) {
    return NextResponse.json(
      { error: "Aucun justificatif n'est attendu pour cette demande." },
      { status: 400 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Type de fichier non accepté (PDF ou image)." }, { status: 400 });
  }
  if (file.size === 0 || file.size > JUSTIFICATIF_MAX_BYTES) {
    return NextResponse.json({ error: "Fichier vide ou trop volumineux (15 Mo max)." }, { status: 400 });
  }

  // Extension comes from the validated MIME type, never from the client's filename.
  const filename = `${id}-${Date.now()}.${extFromMime(file.type) ?? "pdf"}`;
  await mkdir(justificatifDir(), { recursive: true });
  await writeFile(justificatifFilePath(filename), Buffer.from(await file.arrayBuffer()));

  try {
    await prisma.leaveRequest.update({
      where: { id },
      data: { justificatifFile: filename, justificatifMime: file.type, justificatifAt: new Date() },
    });
  } catch (err) {
    // Never leave an unreferenced file behind when the row could not be saved.
    await unlink(justificatifFilePath(filename)).catch(() => {});
    console.error("justificatif: enregistrement impossible", err);
    return NextResponse.json({ error: "Enregistrement impossible, réessayez." }, { status: 500 });
  }

  // Replacing: drop the previous file (best effort — a leftover is harmless).
  if (request.justificatifFile) {
    await unlink(justificatifFilePath(request.justificatifFile)).catch(() => {});
  }

  await notifyTeamReviewers(
    request.user.company,
    request.user.managerId,
    "LEAVE_JUSTIFICATIF_ADDED",
    `${request.user.name} a déposé un justificatif pour son absence du ${format(request.startDate, "dd/MM/yyyy")}.`,
    "/conges",
  );

  return NextResponse.json({ success: true });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { id } = await params;
  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { user: { select: { name: true, company: true, managerId: true } } },
  });
  if (!request || !request.justificatifFile) {
    return NextResponse.json({ error: "Justificatif non disponible." }, { status: 404 });
  }

  const { role, id: userId } = session.user;
  let allowed = request.userId === userId;
  if (!allowed && (role === "MANAGER" || role === "ADMIN" || role === "SUPERVISEUR")) {
    const company = await getActiveCompany(role, session.user.company);
    allowed =
      request.user.company === company &&
      // SUPERVISEUR stays team-scoped, like every other leave view.
      (role !== "SUPERVISEUR" || request.user.managerId === userId);
  }
  if (!allowed) return NextResponse.json({ error: "Justificatif non disponible." }, { status: 404 });

  const mime = request.justificatifMime ?? "application/pdf";
  const buffer = await readFile(justificatifFilePath(request.justificatifFile)).catch(() => null);
  if (!buffer) return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${downloadName(request.user.name, request.startDate, mime)}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
