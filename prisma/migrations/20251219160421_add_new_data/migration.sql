/*
  Warnings:

  - Added the required column `company_identifier` to the `companies` table without a default value. This is not possible if the table is not empty.
  - Added the required column `username` to the `employees` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."companies" ADD COLUMN     "company_identifier" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."employees" ADD COLUMN     "username" TEXT NOT NULL;
