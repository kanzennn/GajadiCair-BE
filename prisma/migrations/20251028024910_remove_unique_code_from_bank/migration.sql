/*
  Warnings:

  - Added the required column `email` to the `employees` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."banks_code_key";

-- AlterTable
ALTER TABLE "public"."employees" ADD COLUMN     "email" TEXT NOT NULL;
