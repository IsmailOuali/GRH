import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { writeFile, mkdir, unlink } from "fs/promises";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notifyCompanyReviewers } from "@/lib/notifications";
import { extFromMime } from "@/lib/coffre-fort";
import {
  ATTACHMENT_MIME_TYPES,
  isValidTicketCategory,
  MAX_ACTIVE_TICKETS_PER_USER,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MAX_DESCRIPTION_LENGTH,
  MAX_SUBJECT_LENGTH,
} from "@/lib/tickets";
import { ticketFilePath, ticketFilesDir } from "@/lib/tickets-storage";

/**
 * A salarié opens a ticket, optionally with screenshots / images / a PDF to help
 * the RH understand it. Any role can.
 *
 * This is a route handler rather than a server action on purpose: a server
 * action's request body is capped at 1 MB, which a single screenshot exceeds.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const userId = session.user.id;

  const formData = await req.formData();
  // Form values can be missing or a File: only accept real strings.
  const field = (name: string): string => {
    const v = formData.get(name);
    return typeof v === "string" ? v.trim() : "";
  };
  const category = field("category");
  const subject = field("subject");
  const description = field("description");
  const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

  if (!isValidTicketCategory(category)) return bad("Choisissez une catégorie.");
  if (!subject) return bad("L'objet est obligatoire.");
  if (subject.length > MAX_SUBJECT_LENGTH) return bad(`L'objet ne peut pas dépasser ${MAX_SUBJECT_LENGTH} caractères.`);
  if (!description) return bad("Décrivez votre demande.");
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return bad(`La description ne peut pas dépasser ${MAX_DESCRIPTION_LENGTH} caractères.`);
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_ATTACHMENTS) return bad(`${MAX_ATTACHMENTS} fichiers maximum par ticket.`);
  for (const file of files) {
    if (!ATTACHMENT_MIME_TYPES.includes(file.type)) {
      return bad(`« ${file.name} » : type non accepté (images PNG, JPEG, WebP ou PDF).`);
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return bad(`« ${file.name} » est trop volumineux (${MAX_ATTACHMENT_BYTES / 1024 / 1024} Mo max par fichier).`);
    }
  }

  const active = await prisma.ticket.count({
    where: { userId, status: { in: ["OPEN", "IN_PROGRESS"] } },
  });
  if (active >= MAX_ACTIVE_TICKETS_PER_USER) {
    return bad(
      `Vous avez déjà ${MAX_ACTIVE_TICKETS_PER_USER} tickets en cours. Attendez une réponse des RH avant d'en ouvrir un autre.`,
    );
  }

  const ticket = await prisma.ticket.create({ data: { userId, category, subject, description } });

  // Files: written under a name we generate (the extension comes from the
  // validated MIME type, never from the client's filename), then recorded.
  const written: string[] = [];
  try {
    if (files.length > 0) await mkdir(ticketFilesDir(), { recursive: true });
    const rows = [];
    for (const [i, file] of files.entries()) {
      const filename = `${ticket.id}-${i + 1}-${Date.now()}.${extFromMime(file.type) ?? "bin"}`;
      await writeFile(ticketFilePath(filename), Buffer.from(await file.arrayBuffer()));
      written.push(filename);
      rows.push({
        ticketId: ticket.id,
        filename,
        // Display only: stripped of any path and capped.
        originalName: file.name.replace(/[\\/]/g, "_").slice(0, 120) || "capture",
        mimeType: file.type,
        size: file.size,
      });
    }
    if (rows.length > 0) await prisma.ticketAttachment.createMany({ data: rows });
  } catch (err) {
    // All or nothing: no half-created ticket, no orphan file.
    await Promise.all(written.map((f) => unlink(ticketFilePath(f)).catch(() => {})));
    await prisma.ticket.delete({ where: { id: ticket.id } }).catch(() => {});
    console.error("ticket: enregistrement impossible", err);
    return NextResponse.json({ error: "Enregistrement impossible, réessayez." }, { status: 500 });
  }

  const author = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, company: true },
  });
  if (author) {
    await notifyCompanyReviewers(
      author.company,
      "TICKET_SUBMITTED",
      `${author.name} a ouvert un ticket : ${subject}`,
      "/tickets",
    );
  }

  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  return NextResponse.json({ success: true });
}
