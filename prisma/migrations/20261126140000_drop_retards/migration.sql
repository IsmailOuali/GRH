-- Lateness is no longer tracked.
ALTER TABLE "TrackedEmployee" DROP COLUMN "repriseRetardsNb";
ALTER TABLE "TrackedEmployee" DROP COLUMN "repriseRetardsH";
