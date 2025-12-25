/*
  Warnings:

  - Added the required column `type` to the `payroll_deduction_rules` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."PayrollDeductionType" AS ENUM ('LATE', 'ABSENT', 'LEAVE', 'SICK');

-- AlterTable
ALTER TABLE "public"."payroll_deduction_rules" ADD COLUMN     "max_minutes" INTEGER,
ADD COLUMN     "per_minute" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "type" "public"."PayrollDeductionType" NOT NULL;
