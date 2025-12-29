-- DropForeignKey
ALTER TABLE "public"."CompanyWorkingDay" DROP CONSTRAINT "CompanyWorkingDay_company_id_fkey";

-- AddForeignKey
ALTER TABLE "public"."CompanyWorkingDay" ADD CONSTRAINT "CompanyWorkingDay_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON DELETE CASCADE ON UPDATE CASCADE;
