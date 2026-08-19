"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function markNotificationRead(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Non authentifié." };

  await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { read: true },
  });
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
