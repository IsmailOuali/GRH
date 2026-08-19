-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "logoPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- Seed the two companies that were previously hardcoded.
INSERT INTO "Company" ("id", "code", "name", "tagline") VALUES
    ('c-fairup', 'FAIRUP', 'Fair''Up', 'Portail RH — Marrakech'),
    ('c-fair2up', 'FAIR2UP', 'FAIR2UP', 'Portail RH — Groupe');
