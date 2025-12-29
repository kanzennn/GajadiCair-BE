/*
  Warnings:

  - Added the required column `level_plan` to the `company_subscription_transaction_histories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `plan_duration_months` to the `company_subscription_transaction_histories` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."company_subscription_transaction_histories" ADD COLUMN     "level_plan" INTEGER NOT NULL,
ADD COLUMN     "plan_duration_months" INTEGER NOT NULL;
