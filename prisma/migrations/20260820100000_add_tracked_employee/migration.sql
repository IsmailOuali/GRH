-- CreateTable
CREATE TABLE "TrackedEmployee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company" TEXT NOT NULL DEFAULT 'FAIRUP',
    "externalId" INTEGER,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "nomComplet" TEXT NOT NULL,
    "poste" TEXT,
    "dateEntree" TEXT,
    "dateSortie" TEXT,
    "soldeCongesN" REAL,
    "repriseCongesPris" REAL NOT NULL DEFAULT 0,
    "repriseAbsences" REAL NOT NULL DEFAULT 0,
    "repriseRetardsNb" INTEGER NOT NULL DEFAULT 0,
    "repriseRetardsH" REAL NOT NULL DEFAULT 0,
    "userId" TEXT,
    "importedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrackedEmployee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackedEmployee_userId_key" ON "TrackedEmployee"("userId");

-- CreateIndex
CREATE INDEX "TrackedEmployee_company_idx" ON "TrackedEmployee"("company");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedEmployee_company_nomComplet_key" ON "TrackedEmployee"("company", "nomComplet");

