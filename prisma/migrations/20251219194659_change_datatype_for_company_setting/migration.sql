-- AlterTable
ALTER TABLE "public"."companies" ALTER COLUMN "attendance_open_time" SET DATA TYPE TIME(0),
ALTER COLUMN "attendance_close_time" SET DATA TYPE TIME(0),
ALTER COLUMN "work_start_time" SET DATA TYPE TIME(0),
ALTER COLUMN "work_end_time" SET DATA TYPE TIME(0),
ALTER COLUMN "attendance_tolerance_minutes" SET DEFAULT 0;
