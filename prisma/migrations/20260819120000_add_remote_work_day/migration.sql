-- CreateTable
CREATE TABLE "RemoteWorkDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RemoteWorkDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RemoteWorkDay_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RemoteWorkDay_date_idx" ON "RemoteWorkDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteWorkDay_userId_date_key" ON "RemoteWorkDay"("userId", "date");
