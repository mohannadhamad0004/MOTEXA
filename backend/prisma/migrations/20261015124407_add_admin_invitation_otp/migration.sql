-- CreateTable
CREATE TABLE "AdminInvitationOtp" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminInvitationOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminInvitationOtp_invitationId_createdAt_idx" ON "AdminInvitationOtp"("invitationId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminInvitationOtp" ADD CONSTRAINT "AdminInvitationOtp_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "AdminInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
