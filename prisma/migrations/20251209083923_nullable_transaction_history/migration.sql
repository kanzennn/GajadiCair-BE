-- AlterTable
ALTER TABLE "public"."company_subscription_transaction_histories" ALTER COLUMN "midtrans_transaction_id" DROP NOT NULL,
ALTER COLUMN "midtrans_status" DROP NOT NULL;
