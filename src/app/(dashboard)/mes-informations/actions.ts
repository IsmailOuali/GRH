"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { notifyCompanyReviewers, notifyUser } from "@/lib/notifications";
import { getTopic, MAX_CHANGE_COMMENT, TOPIC_LABELS, validateChange } from "@/lib/profile-changes";

type Result = { success: true } | { error: string };

/** The salarié's current fiche: the latest dossier linked to their account. */
function findDossier(userId: string) {
  return prisma.employeeDossier.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } });
}

/** A stored column value as comparable text (RIB spaces never count as a change). */
function comparable(column: string, value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  return column === "rib" ? text.replace(/[\s.-]+/g, "") : text;
}

function parseValues(json: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(([, v]) => typeof v === "string"),
    ) as Record<string, string>;
  } catch {
    return {};
  }
}

/** A salarié asks to change one block of their fiche. Nothing is applied yet. */
export async function submitProfileChange(formData: FormData): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };

  // FormData values can be missing or a File: only accept real strings.
  const field = (name: string): string => {
    const v = formData.get(name);
    return typeof v === "string" ? v.trim() : "";
  };

  const topic = getTopic(field("topic"));
  if (!topic) return { error: "Choisissez ce que vous souhaitez modifier." };

  const raw: Record<string, string> = {};
  for (const column of topic.fields) raw[column] = field(column);
  const checked = validateChange(topic.value, raw);
  if ("error" in checked) return { error: checked.error };

  const userId = session.user.id;
  const dossier = await findDossier(userId);
  if (!dossier) return { error: "Votre fiche n'a pas encore été créée par les RH." };

  const current = dossier as unknown as Record<string, unknown>;
  const previous: Record<string, string> = {};
  for (const column of topic.fields) previous[column] = typeof current[column] === "string" ? (current[column] as string) : "";
  if (topic.fields.every((c) => checked.values[c] === comparable(c, previous[c]))) {
    return { error: "Ces informations sont identiques à celles de votre fiche." };
  }

  const alreadyPending = await prisma.profileChangeRequest.count({
    where: { userId, topic: topic.value, status: "PENDING" },
  });
  if (alreadyPending > 0) {
    return { error: `Une demande de modification (${topic.label}) est déjà en attente de validation.` };
  }

  await prisma.profileChangeRequest.create({
    data: {
      userId,
      topic: topic.value,
      newValues: JSON.stringify(checked.values),
      previousValues: JSON.stringify(previous),
      comment: field("comment").slice(0, MAX_CHANGE_COMMENT) || null,
    },
  });

  const author = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, company: true },
  });
  if (author) {
    await notifyCompanyReviewers(
      author.company,
      "PROFILE_CHANGE_SUBMITTED",
      `${author.name} demande une modification de sa fiche (${topic.label}).`,
      "/mes-informations",
    );
  }

  revalidatePath("/mes-informations");
  revalidatePath("/dashboard");
  return { success: true };
}

/** The salarié withdraws a request that is still pending. */
export async function cancelProfileChange(id: string): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };

  const request = await prisma.profileChangeRequest.findUnique({ where: { id } });
  if (!request || request.userId !== session.user.id) return { error: "Demande introuvable." };
  if (request.status !== "PENDING") return { error: "Cette demande a déjà été traitée." };

  await prisma.profileChangeRequest.delete({ where: { id } });

  revalidatePath("/mes-informations");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * The RH approves (the values are written to the dossier) or rejects. MANAGER /
 * ADMIN only, scoped to the active company, never on their own request.
 */
export async function reviewProfileChange(
  id: string,
  decision: "APPROVED" | "REJECTED",
  reviewNote?: string,
): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };
  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") return { error: "Accès refusé." };
  if (decision !== "APPROVED" && decision !== "REJECTED") return { error: "Paramètres invalides." };

  const request = await prisma.profileChangeRequest.findUnique({
    where: { id },
    include: { user: { select: { company: true } } },
  });
  if (!request) return { error: "Demande introuvable." };

  const company = await getActiveCompany(role, session.user.company);
  if (request.user.company !== company) return { error: "Accès refusé." };
  if (request.userId === session.user.id) {
    return { error: "Vous ne pouvez pas valider votre propre demande." };
  }
  if (request.status !== "PENDING") return { error: "Cette demande a déjà été traitée." };

  if (decision === "APPROVED") {
    // Re-validate what is stored instead of trusting it blindly: only the
    // topic's own columns, in their normalised form, ever reach the dossier.
    const checked = validateChange(request.topic, parseValues(request.newValues));
    if ("error" in checked) return { error: "Les valeurs de cette demande sont invalides." };

    const dossier = await findDossier(request.userId);
    if (!dossier) return { error: "Ce salarié n'a plus de fiche à mettre à jour." };

    await prisma.employeeDossier.update({
      where: { id: dossier.id },
      data: { ...checked.values, updatedById: session.user.id },
    });
  }

  await prisma.profileChangeRequest.update({
    where: { id },
    data: {
      status: decision,
      reviewedById: session.user.id,
      reviewNote: reviewNote?.trim().slice(0, MAX_CHANGE_COMMENT) || null,
      reviewedAt: new Date(),
    },
  });

  const label = TOPIC_LABELS[request.topic] ?? "fiche";
  await notifyUser(
    request.userId,
    "PROFILE_CHANGE_REVIEWED",
    decision === "APPROVED"
      ? `Votre modification (${label}) a été validée : votre fiche est à jour.`
      : `Votre modification (${label}) a été refusée.`,
    "/mes-informations",
  );

  revalidatePath("/mes-informations");
  revalidatePath("/dashboard");
  revalidatePath("/admin/dossiers");
  return { success: true };
}
