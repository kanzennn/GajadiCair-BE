-- CreateTable
CREATE TABLE "public"."CompanyCustomHoliday" (
    "company_custom_holiday_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "CompanyCustomHoliday_pkey" PRIMARY KEY ("company_custom_holiday_id")
);

-- AddForeignKey
ALTER TABLE "public"."CompanyCustomHoliday" ADD CONSTRAINT "CompanyCustomHoliday_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON DELETE CASCADE ON UPDATE CASCADE;
