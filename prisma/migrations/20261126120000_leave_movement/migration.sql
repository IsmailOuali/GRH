-- CreateTable
CREATE TABLE "LeaveMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "delta" REAL NOT NULL,
    "balanceAfter" REAL NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "leaveRequestId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaveMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LeaveMovement_userId_createdAt_idx" ON "LeaveMovement"("userId", "createdAt");

-- What happened before this table existed is unknown: start each history from
-- the current solde. Prisma stores DateTime in SQLite as epoch milliseconds.
INSERT INTO "LeaveMovement" ("id", "userId", "delta", "balanceAfter", "kind", "note", "createdAt")
SELECT lower(hex(randomblob(12))), "userId", "cpDays", "cpDays", 'OPENING', 'Solde à l''ouverture du suivi',
       CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM "LeaveBalance"
WHERE "cpDays" <> 0;
