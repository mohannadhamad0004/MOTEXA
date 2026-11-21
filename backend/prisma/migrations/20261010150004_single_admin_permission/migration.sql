/*
  Warnings:

  - You are about to drop the column `permissions` on the `AdminInvitation` table. All the data in the column will be lost.
  - Added the required column `permission` to the `AdminInvitation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AdminInvitation" DROP COLUMN "permissions",
ADD COLUMN     "permission" TEXT NOT NULL;
