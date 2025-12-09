/*
  Warnings:

  - You are about to drop the column `total_amount` on the `company_subscription_transaction_histories` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."company_subscription_transaction_histories" DROP COLUMN "total_amount";
