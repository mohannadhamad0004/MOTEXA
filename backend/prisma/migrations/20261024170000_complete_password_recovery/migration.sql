BEGIN;
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PasswordResetRequest" ADD COLUMN "resetTokenHash" TEXT;
ALTER TABLE "PasswordResetRequest" ADD COLUMN "resetExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "PasswordResetRequest_resetTokenHash_key" ON "PasswordResetRequest"("resetTokenHash");
COMMIT;
