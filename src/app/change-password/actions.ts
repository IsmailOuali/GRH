"use server";

import bcrypt from "bcryptjs";
import { auth, unstable_update } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function changePassword(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Session expirée. Reconnectez-vous." };

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!currentPassword || !newPassword || !confirmPassword)
    return { error: "Tous les champs sont obligatoires." };
  if (newPassword.length < 6) return { error: "Le nouveau mot de passe doit contenir au moins 6 caractères." };
  if (newPassword !== confirmPassword) return { error: "Les mots de passe ne correspondent pas." };

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { error: "Utilisateur introuvable." };
  if (!bcrypt.compareSync(currentPassword, user.password))
    return { error: "Le mot de passe actuel est incorrect." };
  if (bcrypt.compareSync(newPassword, user.password))
    return { error: "Le nouveau mot de passe doit être différent de l'ancien." };

  await prisma.user.update({
    where: { id: user.id },
    data: { password: bcrypt.hashSync(newPassword, 10), mustChangePassword: false },
  });

  // Refresh the JWT so the proxy gate stops forcing the change on the next request.
  await unstable_update({ user: { mustChangePassword: false } });

  return { success: true };
}
