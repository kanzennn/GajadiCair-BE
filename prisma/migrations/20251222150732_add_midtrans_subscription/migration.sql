-- CreateEnum
CREATE TYPE "public"."SubscriptionChangeType" AS ENUM ('NEW', 'RENEW', 'EXTEND', 'UPGRADE', 'DOWNGRADE');

-- AlterTable
ALTER TABLE "public"."company_subscription_transaction_histories" ADD COLUMN     "change_type" "public"."SubscriptionChangeType" NOT NULL DEFAULT 'NEW',
ADD COLUMN     "from_level_plan" INTEGER,
ADD COLUMN     "period_end" TIMESTAMP(3),
ADD COLUMN     "period_start" TIMESTAMP(3);
