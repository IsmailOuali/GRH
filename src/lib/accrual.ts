import { prisma } from "@/lib/prisma";

/**
 * Monthly "congés payés" accrual.
 *
 * Rule (Code du travail marocain, art. 231): every month of service credits
 * 1,5 jour ouvrable of CP. There is no proration — someone hired on the 20th
 * still earns the full 1,5 for that month — and no ceiling on the balance.
 * RTT is not accrued; it stays admin-managed.
 *
 * There is no scheduler in this app, so accrual is *lazy*: every read path
 * that shows or spends a balance calls {@link accrueLeaveBalance} first, which
 * credits every whole month elapsed since the last run in one go. That makes it
 * self-healing (a server offline for three months still credits 4,5 on the next
 * page load) and safe to call as often as we like.
 */

/** Days of CP credited per whole month of service. */
export const CP_MONTHLY_ACCRUAL = 1.5;

/** First instant of the month `d` falls in (local time). */
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Whole calendar months from `from` to `to` (negative if `to` is earlier). */
function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

/**
 * `lastAccrualAt` for a balance being created now.
 *
 * The field means "start of the last month already credited", so we anchor one
 * month *before* the starting month — that way the first accrual run credits
 * the starting month in full, whatever day of it the employee was hired on.
 *
 * The starting month is the hire month, but never earlier than the current one:
 * back-dating a hire date when creating the account must not retroactively
 * credit years of CP on top of the opening balance the admin typed in.
 */
export function initialAccrualAnchor(hireDate: Date, now: Date = new Date()): Date {
  const start = startOfMonth(hireDate > now ? hireDate : now);
  return new Date(start.getFullYear(), start.getMonth() - 1, 1);
}

/**
 * Credits `1,5 × (whole months elapsed)` to one employee's CP balance.
 * No-ops when the balance is missing or already up to date. Returns the number
 * of days actually credited.
 */
export async function accrueLeaveBalance(userId: string, now: Date = new Date()): Promise<number> {
  const balance = await prisma.leaveBalance.findUnique({
    where: { userId },
    select: { lastAccrualAt: true },
  });
  if (!balance) return 0;

  const currentMonth = startOfMonth(now);
  const months = monthsBetween(balance.lastAccrualAt, currentMonth);
  if (months <= 0) return 0;

  const credited = CP_MONTHLY_ACCRUAL * months;

  // Compare-and-swap on lastAccrualAt: if a concurrent request already credited
  // these months, the WHERE no longer matches and this update is a no-op.
  const { count } = await prisma.leaveBalance.updateMany({
    where: { userId, lastAccrualAt: balance.lastAccrualAt },
    data: { cpDays: { increment: credited }, lastAccrualAt: currentMonth },
  });

  return count === 1 ? credited : 0;
}

/**
 * Same, for every employee of a company at once. Used where a manager reads
 * balances other than their own, so the figures they act on are current.
 */
export async function accrueCompanyLeaveBalances(
  company: string,
  now: Date = new Date(),
): Promise<number> {
  const stale = await prisma.leaveBalance.findMany({
    where: { lastAccrualAt: { lt: startOfMonth(now) }, user: { company } },
    select: { userId: true },
  });

  let total = 0;
  for (const { userId } of stale) total += await accrueLeaveBalance(userId, now);
  return total;
}
