/*
  Warnings:

  - Added the required column `fullName` to the `AdminInvitation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AdminInvitation" ADD COLUMN     "fullName" TEXT NOT NULL;
