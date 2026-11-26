/**
 * The history of the CP solde. Every write to LeaveBalance.cpDays goes with a
 * LeaveMovement row, in the same transaction, so the history always adds up to
 * the solde: use these helpers rather than updating cpDays directly.
 *
 * (The monthly accrual writes its own rows in accrual.ts: one per month, inside
 * its compare-and-swap.)
 */

import type { Prisma } from "@prisma/client";

export type MovementKind = "OPENING" | "ACCRUAL" | "LEAVE" | "ADJUSTMENT" | "RECALC";

export const MOVEMENT_LABELS: Record<MovementKind, string> = {
  OPENING: "Solde initial",
  ACCRUAL: "Acquisition mensuelle",
  LEAVE: "Congé validé",
  ADJUSTMENT: "Correction RH",
  RECALC: "Recalcul",
};

type Meta = { kind: MovementKind; note: string; leaveRequestId?: string };

/** Adds `delta` days (negative to deduct). Does nothing without a balance. */
export async function changeBalance(
  tx: Prisma.TransactionClient,
  userId: string,
  delta: number,
  meta: Meta,
): Promise<void> {
  if (delta === 0) return;
  const { count } = await tx.leaveBalance.updateMany({
    where: { userId },
    data: { cpDays: { increment: delta } },
  });
  if (count === 0) return;
  const { cpDays } = await tx.leaveBalance.findUniqueOrThrow({
    where: { userId },
    select: { cpDays: true },
  });
  await tx.leaveMovement.create({ data: { userId, delta, balanceAfter: cpDays, ...meta } });
}

/** Overwrites the solde of an existing balance (manual correction by the RH). */
export async function setBalance(
  tx: Prisma.TransactionClient,
  userId: string,
  cpDays: number,
  meta: Meta,
): Promise<void> {
  const before = await tx.leaveBalance.findUniqueOrThrow({
    where: { userId },
    select: { cpDays: true },
  });
  if (before.cpDays === cpDays) return;
  await tx.leaveBalance.update({ where: { userId }, data: { cpDays } });
  await tx.leaveMovement.create({
    data: { userId, delta: cpDays - before.cpDays, balanceAfter: cpDays, ...meta },
  });
}
