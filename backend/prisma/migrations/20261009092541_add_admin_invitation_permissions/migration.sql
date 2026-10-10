-- AlterTable
ALTER TABLE "AdminInvitation" ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
