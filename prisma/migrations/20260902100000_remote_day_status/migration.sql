-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RemoteWorkDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "requestId" TEXT,
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RemoteWorkDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RemoteWorkDay_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RemoteWorkDay_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RemoteWorkDay" ("createdAt", "createdById", "date", "id", "note", "userId") SELECT "createdAt", "createdById", "date", "id", "note", "userId" FROM "RemoteWorkDay";
DROP TABLE "RemoteWorkDay";
ALTER TABLE "new_RemoteWorkDay" RENAME TO "RemoteWorkDay";
CREATE INDEX "RemoteWorkDay_date_idx" ON "RemoteWorkDay"("date");
CREATE INDEX "RemoteWorkDay_status_idx" ON "RemoteWorkDay"("status");
CREATE INDEX "RemoteWorkDay_requestId_idx" ON "RemoteWorkDay"("requestId");
CREATE UNIQUE INDEX "RemoteWorkDay_userId_date_key" ON "RemoteWorkDay"("userId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

