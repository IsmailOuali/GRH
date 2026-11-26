import type { Prisma } from "@prisma/client";
import { addDays } from "@/lib/aid";
import { formatFrIso, toIso } from "@/lib/dates";
import { changeBalance } from "@/lib/leave-ledger";
import { countLeaveDays, cpDaysToDeduct, specialLeaveFreeDays } from "@/lib/leave-types";

/** A request ending this shortly before an Aïd can have its date de reprise moved. */
const REPRISE_MARGIN_DAYS = 7;

const LIVE = ["PENDING", "APPROVED"];

export type RecalculatedLeave = { userId: string; delta: number };

/** Live requests whose day count or date de reprise may depend on `affectedDays`. */
export function leavesAround(affectedDays: string[]): Prisma.LeaveRequestWhereInput {
  const sorted = [...affectedDays].sort();
  return {
    status: { in: LIVE },
    startDate: { lte: new Date(`${sorted[sorted.length - 1]}T23:59:59Z`) },
    endDate: { gte: new Date(addDays(sorted[0], -REPRISE_MARGIN_DAYS)) },
  };
}

/**
 * Recounts the live requests touched by an Aïd whose date was confirmed or
 * moved, and corrects the CP solde of those already approved. Requests whose
 * day count does not change are left untouched.
 */
export async function recalculateLeaves(
  tx: Prisma.TransactionClient,
  affectedDays: string[],
  aidDates: ReadonlySet<string>,
): Promise<RecalculatedLeave[]> {
  const candidates = await tx.leaveRequest.findMany({ where: leavesAround(affectedDays) });
  const changed: RecalculatedLeave[] = [];

  async function save(
    r: { id: string; userId: string; status: string; days: number; cpDeducted: number; startDate: Date; endDate: Date },
    days: number,
    cpDeducted: number,
  ) {
    if (days === r.days && cpDeducted === r.cpDeducted) return;
    await tx.leaveRequest.update({ where: { id: r.id }, data: { days, cpDeducted } });
    // The solde was only debited when the request was approved.
    if (r.status === "APPROVED" && cpDeducted !== r.cpDeducted) {
      await changeBalance(tx, r.userId, r.cpDeducted - cpDeducted, {
        kind: "RECALC",
        note: `Date de l'Aïd confirmée : congé du ${formatFrIso(toIso(r.startDate))} au ${formatFrIso(toIso(r.endDate))}`,
        leaveRequestId: r.id,
      });
    }
    changed.push({ userId: r.userId, delta: days - r.days });
  }

  const splitEvents = new Set<string>();

  for (const r of candidates) {
    const days = countLeaveDays(r.type, r.startDate, r.endDate, aidDates);
    if (days === r.days) continue;

    if (specialLeaveFreeDays(r.type) !== undefined && r.eventDate) {
      // Free days are shared by all the requests of one event: redone below.
      splitEvents.add(JSON.stringify([r.userId, r.type, r.eventDate.toISOString()]));
      continue;
    }
    // Moved by the difference, so a row with an unusual cpDeducted stays coherent.
    const cp = r.type === "CP" ? Math.max(0, r.cpDeducted + (days - r.days)) : r.cpDeducted;
    await save(r, days, cp);
  }

  for (const key of splitEvents) {
    const [userId, type, eventDate] = JSON.parse(key) as [string, string, string];
    const group = await tx.leaveRequest.findMany({
      where: { userId, type, eventDate: new Date(eventDate), status: { in: LIVE } },
      orderBy: { createdAt: "asc" },
    });
    let used = 0;
    for (const r of group) {
      const days = countLeaveDays(r.type, r.startDate, r.endDate, aidDates);
      await save(r, days, cpDaysToDeduct(r.type, days, used));
      used += days;
    }
  }

  return changed;
}
