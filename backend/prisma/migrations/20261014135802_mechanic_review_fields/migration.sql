-- AlterTable
ALTER TABLE "MechanicApplication" ADD COLUMN     "professionalPreReview" "PreReviewObservation" NOT NULL DEFAULT 'NOT_REVIEWED',
ADD COLUMN     "professionalPreReviewNote" TEXT,
ADD COLUMN     "reviewReason" TEXT,
ADD COLUMN     "reviewStatus" "MechanicReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
ADD COLUMN     "workshopPreReview" "PreReviewObservation" NOT NULL DEFAULT 'NOT_REVIEWED',
ADD COLUMN     "workshopPreReviewNote" TEXT;

-- AlterTable
ALTER TABLE "MechanicSkillApplication" ADD COLUMN     "rejectionReason" TEXT;
