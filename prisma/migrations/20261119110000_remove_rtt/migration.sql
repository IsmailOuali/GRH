-- RTT is no longer a leave type: drop its requests and the per-user solde.
DELETE FROM "LeaveRequest" WHERE "type" = 'RTT';

-- AlterTable
ALTER TABLE "LeaveBalance" DROP COLUMN "rttDays";
