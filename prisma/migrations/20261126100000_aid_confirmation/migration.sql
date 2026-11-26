-- CreateTable
CREATE TABLE "AidConfirmation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feast" TEXT NOT NULL,
    "hijriYear" INTEGER NOT NULL,
    "startDate" TEXT NOT NULL,
    "confirmedById" TEXT,
    "confirmedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "AidConfirmation_feast_hijriYear_key" ON "AidConfirmation"("feast", "hijriYear");
