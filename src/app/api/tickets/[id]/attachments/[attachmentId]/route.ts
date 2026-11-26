import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { isImageMime } from "@/lib/tickets";
import { ticketFilePath } from "@/lib/tickets-storage";

/**
 * Serves a file attached to a ticket: to its author, or to the RH (MANAGER /
 * ADMIN) of the author's company. Anyone else gets the same answer as for a
 * file that does not exist.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { id, attachmentId } = await params;
  const attachment = await prisma.ticketAttachment.findFirst({
    where: { id: attachmentId, ticketId: id },
    include: { ticket: { select: { userId: true, user: { select: { company: true } } } } },
  });
  const notFound = () => NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  if (!attachment) return notFound();

  const { role, id: userId } = session.user;
  let allowed = attachment.ticket.userId === userId;
  if (!allowed && (role === "MANAGER" || role === "ADMIN")) {
    const company = await getActiveCompany(role, session.user.company);
    allowed = attachment.ticket.user.company === company;
  }
  if (!allowed) return notFound();

  const buffer = await readFile(ticketFilePath(attachment.filename)).catch(() => null);
  if (!buffer) return notFound();

  // Images are shown in place (thumbnails, full view in a new tab); a PDF is
  // downloaded. The type was validated at upload and nosniff stops the browser
  // from second-guessing it.
  const inline = isImageMime(attachment.mimeType);
  const safeName = attachment.originalName.replace(/[^\w.\- ]+/g, "_");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
