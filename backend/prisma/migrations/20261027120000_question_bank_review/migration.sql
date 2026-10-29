ALTER TABLE "MechanicQuestion"
ADD COLUMN "code" TEXT,
ADD COLUMN "explanation" TEXT NOT NULL DEFAULT '',
ADD COLUMN "sourceUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN "sourceReference" TEXT NOT NULL DEFAULT '',
ADD COLUMN "difficulty" TEXT NOT NULL DEFAULT 'INTERMEDIATE',
ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "reviewerName" TEXT,
ADD COLUMN "reviewNotes" TEXT,
ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "MechanicQuestion_code_key" ON "MechanicQuestion"("code");
UPDATE "MechanicQuestion" SET "active" = false;
ALTER TABLE "MechanicQuestion" ADD CONSTRAINT "MechanicQuestion_reviewStatus_check" CHECK ("reviewStatus" IN ('DRAFT','APPROVED','DISABLED'));
ALTER TABLE "MechanicQuestion" ADD CONSTRAINT "MechanicQuestion_difficulty_check" CHECK ("difficulty" IN ('FOUNDATION','INTERMEDIATE','ADVANCED'));
ALTER TABLE "MechanicQuestion" ADD CONSTRAINT "MechanicQuestion_active_review_check" CHECK (NOT "active" OR "reviewStatus" = 'APPROVED');

ALTER TABLE "MechanicQuestion" ALTER COLUMN "active" SET DEFAULT false;
