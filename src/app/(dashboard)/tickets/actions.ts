"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { notifyCompanyReviewers, notifyUser } from "@/lib/notifications";
import {
  isValidTicketCategory,
  MAX_ACTIVE_TICKETS_PER_USER,
  MAX_DESCRIPTION_LENGTH,
  MAX_RESPONSE_LENGTH,
  MAX_SUBJECT_LENGTH,
} from "@/lib/tickets";

type Result = { success: true } | { error: string };

/** A salarié opens a ticket. Any role can. */
export async function submitTicket(formData: FormData): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };

  // FormData values can be missing or a File: only accept real strings.
  const field = (name: string): string => {
    const v = formData.get(name);
    return typeof v === "string" ? v.trim() : "";
  };
  const category = field("category");
  const subject = field("subject");
  const description = field("description");

  if (!isValidTicketCategory(category)) return { error: "Choisissez une catégorie." };
  if (!subject) return { error: "L'objet est obligatoire." };
  if (subject.length > MAX_SUBJECT_LENGTH)
    return { error: `L'objet ne peut pas dépasser ${MAX_SUBJECT_LENGTH} caractères.` };
  if (!description) return { error: "Décrivez votre demande." };
  if (description.length > MAX_DESCRIPTION_LENGTH)
    return { error: `La description ne peut pas dépasser ${MAX_DESCRIPTION_LENGTH} caractères.` };

  const userId = session.user.id;
  const active = await prisma.ticket.count({
    where: { userId, status: { in: ["OPEN", "IN_PROGRESS"] } },
  });
  if (active >= MAX_ACTIVE_TICKETS_PER_USER) {
    return {
      error: `Vous avez déjà ${MAX_ACTIVE_TICKETS_PER_USER} tickets en cours. Attendez une réponse des RH avant d'en ouvrir un autre.`,
    };
  }

  await prisma.ticket.create({ data: { userId, category, subject, description } });

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
  return { success: true };
}

/**
 * The RH answers a ticket: either takes it (IN_PROGRESS, message optional) or
 * resolves it (RESOLVED, an answer is required — the salarié must learn what
 * was done). MANAGER/ADMIN only, scoped to the active company.
 */
export async function answerTicket(
  id: string,
  status: "IN_PROGRESS" | "RESOLVED",
  response: string,
): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };
  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") return { error: "Accès refusé." };
  if (status !== "IN_PROGRESS" && status !== "RESOLVED") return { error: "Paramètres invalides." };

  const text = (typeof response === "string" ? response : "").trim();
  if (text.length > MAX_RESPONSE_LENGTH)
    return { error: `La réponse ne peut pas dépasser ${MAX_RESPONSE_LENGTH} caractères.` };
  if (status === "RESOLVED" && !text) return { error: "Écrivez une réponse avant de résoudre le ticket." };

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { user: { select: { company: true } } },
  });
  if (!ticket) return { error: "Ticket introuvable." };

  const company = await getActiveCompany(role, session.user.company);
  if (ticket.user.company !== company) return { error: "Accès refusé." };
  // Nobody answers their own ticket: that would defeat the point of the RH check.
  if (ticket.userId === session.user.id) return { error: "Vous ne pouvez pas répondre à votre propre ticket." };
  if (ticket.status === "RESOLVED") return { error: "Ce ticket est déjà résolu." };

  await prisma.ticket.update({
    where: { id },
    data: {
      status,
      // Taking a ticket without a message keeps any earlier answer.
      ...(text ? { response: text } : {}),
      respondedById: session.user.id,
      respondedAt: new Date(),
    },
  });

  await notifyUser(
    ticket.userId,
    "TICKET_ANSWERED",
    status === "RESOLVED"
      ? `Votre ticket « ${ticket.subject} » a été traité.`
      : `Votre ticket « ${ticket.subject} » est pris en charge par les RH.`,
    "/tickets",
  );

  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  return { success: true };
}
