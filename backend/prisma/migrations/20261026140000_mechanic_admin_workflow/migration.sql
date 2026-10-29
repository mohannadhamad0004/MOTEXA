-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'APPLICATION',
ADD COLUMN     "relatedUserId" TEXT;

-- CreateTable
CREATE TABLE "MechanicQuestion" (
    "id" TEXT NOT NULL,
    "specialization" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" TEXT[],
    "correctIndex" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MechanicQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MechanicTest" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "submissionVersion" INTEGER NOT NULL,
    "attempt" INTEGER NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "score" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "assessment" TEXT,
    "reviewNotes" TEXT,

    CONSTRAINT "MechanicTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MechanicTestItem" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" TEXT[],
    "correctIndex" INTEGER NOT NULL,
    "answerIndex" INTEGER,

    CONSTRAINT "MechanicTestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MechanicMessage" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MechanicMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MechanicDocumentReview" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MechanicDocumentReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MechanicQuestion_specialization_active_idx" ON "MechanicQuestion"("specialization", "active");

-- CreateIndex
CREATE INDEX "MechanicTest_profileId_assignedAt_idx" ON "MechanicTest"("profileId", "assignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MechanicTest_profileId_submissionVersion_attempt_key" ON "MechanicTest"("profileId", "submissionVersion", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "MechanicTestItem_testId_position_key" ON "MechanicTestItem"("testId", "position");

-- CreateIndex
CREATE INDEX "MechanicMessage_profileId_createdAt_id_idx" ON "MechanicMessage"("profileId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "MechanicDocumentReview_profileId_documentId_key" ON "MechanicDocumentReview"("profileId", "documentId");

-- AddForeignKey
ALTER TABLE "MechanicTest" ADD CONSTRAINT "MechanicTest_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "MechanicProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanicTestItem" ADD CONSTRAINT "MechanicTestItem_testId_fkey" FOREIGN KEY ("testId") REFERENCES "MechanicTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanicMessage" ADD CONSTRAINT "MechanicMessage_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "MechanicProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanicMessage" ADD CONSTRAINT "MechanicMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanicDocumentReview" ADD CONSTRAINT "MechanicDocumentReview_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "MechanicProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
