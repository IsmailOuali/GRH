"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashResetToken } from "@/lib/reset-tokens";

export async function resetPassword(formData: FormData) {
  const token = (formData.get("token") as string)?.trim();
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!token) return { error: "Lien invalide." };
  if (!newPassword || !confirmPassword) return { error: "Tous les champs sont obligatoires." };
  if (newPassword.length < 6) return { error: "Le mot de passe doit contenir au moins 6 caractères." };
  if (newPassword !== confirmPassword) return { error: "Les mots de passe ne correspondent pas." };

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
  });

  if (!record || record.usedAt || record.expiresAt < new Date())
    return { error: "Ce lien est invalide ou a expiré. Demandez une nouvelle réinitialisation." };

  // Set the new password, clear the forced-change flag (they just chose it),
  // and consume the token — atomically.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { password: bcrypt.hashSync(newPassword, 10), mustChangePassword: false },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { success: true };
}
