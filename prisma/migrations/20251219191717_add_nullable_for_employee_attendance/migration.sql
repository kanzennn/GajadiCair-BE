-- AlterTable
ALTER TABLE "public"."employee_attendances" ALTER COLUMN "attendance_date" DROP NOT NULL,
ALTER COLUMN "check_in_time" DROP NOT NULL;
