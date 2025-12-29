-- CreateTable
CREATE TABLE "public"."CompanyWorkingDay" (
    "company_working_day_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "monday" BOOLEAN NOT NULL DEFAULT true,
    "tuesday" BOOLEAN NOT NULL DEFAULT true,
    "wednesday" BOOLEAN NOT NULL DEFAULT true,
    "thursday" BOOLEAN NOT NULL DEFAULT true,
    "friday" BOOLEAN NOT NULL DEFAULT true,
    "saturday" BOOLEAN NOT NULL DEFAULT false,
    "sunday" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "CompanyWorkingDay_pkey" PRIMARY KEY ("company_working_day_id")
);

-- AddForeignKey
ALTER TABLE "public"."CompanyWorkingDay" ADD CONSTRAINT "CompanyWorkingDay_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
