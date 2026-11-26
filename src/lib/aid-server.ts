import { prisma } from "@/lib/prisma";
import { buildAids, type Aid } from "@/lib/aid";

/** Every Aïd around today, with the RH confirmations applied. */
export async function getAids(): Promise<Aid[]> {
  const confirmations = await prisma.aidConfirmation.findMany();
  const year = new Date().getFullYear();
  return buildAids(year - 2, year + 3, confirmations);
}

/** The days that are not counted as leave. */
export async function getAidDates(): Promise<Set<string>> {
  return new Set((await getAids()).flatMap((a) => a.days));
}
