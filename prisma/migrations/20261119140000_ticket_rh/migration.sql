-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "subject" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Ticket" ADD COLUMN "response" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "respondedById" TEXT REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD COLUMN "respondedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");
