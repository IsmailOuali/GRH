"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function markNotificationRead(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };

  await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { read: true },
  });
  // The dashboard's "Mes demandes" card lists unread answers: refresh it.
  revalidatePath("/dashboard");
  return { success: true };
}

export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };

  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });
  return { success: true };
}
