/*
  Warnings:

  - You are about to drop the column `face_id` on the `employees` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."employees" DROP COLUMN "face_id",
ADD COLUMN     "is_face_enrolled" BOOLEAN NOT NULL DEFAULT false;
