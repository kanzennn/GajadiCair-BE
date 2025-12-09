-- AlterTable
ALTER TABLE "public"."company_subscription_transaction_histories" ALTER COLUMN "midtrans_admin_fee" DROP NOT NULL,
ALTER COLUMN "midtrans_payment_method" DROP NOT NULL;
