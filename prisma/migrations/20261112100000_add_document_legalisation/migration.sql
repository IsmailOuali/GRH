-- AlterTable
ALTER TABLE "DocumentRequest" ADD COLUMN "legalise" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DocumentRequest" ADD COLUMN "legaliseReason" TEXT;
ALTER TABLE "DocumentRequest" ADD COLUMN "legaliseDelivery" TEXT;
ALTER TABLE "DocumentRequest" ADD COLUMN "legaliseFile" TEXT;
ALTER TABLE "DocumentRequest" ADD COLUMN "legaliseMime" TEXT;
ALTER TABLE "DocumentRequest" ADD COLUMN "legaliseNote" TEXT;
ALTER TABLE "DocumentRequest" ADD COLUMN "legaliseAt" DATETIME;
