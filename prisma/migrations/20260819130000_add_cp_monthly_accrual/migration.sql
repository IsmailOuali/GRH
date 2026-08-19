-- RedefineTables
-- SQLite refuses ALTER TABLE ... ADD COLUMN with a CURRENT_TIMESTAMP default,
-- so the table is rebuilt. Existing rows take the default (= migration time),
-- i.e. the current month counts as already credited and no CP is granted
-- retroactively.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LeaveBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cpDays" REAL NOT NULL DEFAULT 25,
    "rttDays" REAL NOT NULL DEFAULT 10,
    "expiryDate" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "lastAccrualAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaveBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LeaveBalance" ("cpDays", "expiryDate", "id", "rttDays", "updatedAt", "userId") SELECT "cpDays", "expiryDate", "id", "rttDays", "updatedAt", "userId" FROM "LeaveBalance";
DROP TABLE "LeaveBalance";
ALTER TABLE "new_LeaveBalance" RENAME TO "LeaveBalance";
CREATE UNIQUE INDEX "LeaveBalance_userId_key" ON "LeaveBalance"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
