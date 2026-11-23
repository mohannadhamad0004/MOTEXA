-- Additive only: existing accounts, tests and documents are preserved.
ALTER TABLE "MechanicProfile"
 ADD COLUMN "interviewScheduleId" TEXT,
 ADD COLUMN "interviewScheduledAt" TIMESTAMP(3),
 ADD COLUMN "interviewMethod" TEXT,
 ADD COLUMN "interviewLocation" TEXT,
 ADD COLUMN "interviewTimeZone" TEXT,
 ADD COLUMN "interviewConfirmedAt" TIMESTAMP(3),
 ADD COLUMN "interviewSimulation" BOOLEAN NOT NULL DEFAULT false;
