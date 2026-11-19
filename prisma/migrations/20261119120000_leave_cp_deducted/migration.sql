-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN "cpDeducted" REAL NOT NULL DEFAULT 0;

-- Existing CP requests were deducted in full from the CP solde.
UPDATE "LeaveRequest" SET "cpDeducted" = "days" WHERE "type" = 'CP';
