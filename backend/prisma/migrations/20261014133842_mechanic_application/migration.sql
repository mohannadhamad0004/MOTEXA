-- CreateEnum
CREATE TYPE "ReviewItemStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MechanicDocumentKind" AS ENUM ('LICENCE', 'CERTIFICATE');

-- CreateTable
CREATE TABLE "MechanicApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "workshopName" TEXT NOT NULL,
    "workshopAddress" TEXT NOT NULL,
    "licenceNumber" TEXT NOT NULL,
    "licenceHolderName" TEXT NOT NULL,
    "issuingAuthority" TEXT NOT NULL,
    "licenceIssueDate" TIMESTAMP(3),
    "licenceExpiryDate" TIMESTAMP(3),
    "authorizationAccepted" BOOLEAN NOT NULL,
    "authorizationAcceptedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MechanicApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MechanicSkillApplication" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ReviewItemStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "MechanicSkillApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MechanicDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "kind" "MechanicDocumentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MechanicDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MechanicApplication_userId_key" ON "MechanicApplication"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MechanicSkillApplication_applicationId_name_key" ON "MechanicSkillApplication"("applicationId", "name");

-- AddForeignKey
ALTER TABLE "MechanicApplication" ADD CONSTRAINT "MechanicApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanicSkillApplication" ADD CONSTRAINT "MechanicSkillApplication_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MechanicApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanicDocument" ADD CONSTRAINT "MechanicDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MechanicApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
