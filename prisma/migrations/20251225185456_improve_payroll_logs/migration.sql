/*
  Warnings:

  - Added the required column `type` to the `payroll_details` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."PayrollDetailType" AS ENUM ('DEDUCTION', 'ALLOWANCE', 'BASE_SALARY');

-- AlterTable
ALTER TABLE "public"."payroll_details" ADD COLUMN     "type" "public"."PayrollDetailType" NOT NULL;
