"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { notifyUser } from "@/lib/notifications";
import { MAX_RESPONSE_LENGTH } from "@/lib/tickets";

// Opening a ticket (with its files) is the POST route in src/app/api/tickets/route.ts:
// a server action cannot carry a screenshot, its body is capped at 1 MB.
type Result = { success: true } | { error: string };

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
