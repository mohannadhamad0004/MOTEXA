ALTER TABLE "Vehicle3DSubmission"
 ADD COLUMN "provider" TEXT,
 ADD COLUMN "providerState" TEXT,
 ADD COLUMN "providerProgress" INTEGER,
 ADD COLUMN "providerCreatedAt" TIMESTAMP(3),
 ADD COLUMN "providerStartedAt" TIMESTAMP(3),
 ADD COLUMN "providerFinishedAt" TIMESTAMP(3),
 ADD COLUMN "lastProviderCheckAt" TIMESTAMP(3),
 ADD COLUMN "nextPollAt" TIMESTAMP(3),
 ADD COLUMN "generationStage" TEXT NOT NULL DEFAULT 'UPLOAD',
 ADD COLUMN "generationRevision" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "generationErrorCode" TEXT,
 ADD COLUMN "generationHistory" JSONB,
 ADD COLUMN "leaseToken" TEXT,
 ADD COLUMN "leaseUntil" TIMESTAMP(3),
 ADD COLUMN "liveAuthorizedAt" TIMESTAMP(3),
 ADD COLUMN "rawModelPath" TEXT,
 ADD COLUMN "preparationConfig" JSONB,
 ADD COLUMN "catalogConsentAt" TIMESTAMP(3),
 ADD COLUMN "catalogConsentVersion" TEXT,
 ADD COLUMN "visualVerifiedAt" TIMESTAMP(3),
 ADD CONSTRAINT "Vehicle3DSubmission_provider_progress_check" CHECK ("providerProgress" IS NULL OR "providerProgress" BETWEEN 0 AND 100);
CREATE INDEX "Vehicle3DSubmission_job_due_idx" ON "Vehicle3DSubmission" ("status", "nextPollAt", "leaseUntil");
-- Old jobs have no explicit live authorization. Preserve history but never automatically start paid work.
UPDATE "Vehicle3DSubmission" SET "status"='FAILED', "generationStage"='FAILED', "generationErrorCode"='LIVE_OPT_IN_REQUIRED',
 "failureReason"='Explicit live generation authorization is required before retrying.'
 WHERE "status"='PROCESSING' AND "generationMode"='meshy';
