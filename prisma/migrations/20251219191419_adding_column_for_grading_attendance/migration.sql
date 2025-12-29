-- CreateEnum
CREATE TYPE "public"."AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LEAVE', 'SICK');

-- AlterTable
ALTER TABLE "public"."employee_attendances" ADD COLUMN     "absent_reason" TEXT,
ADD COLUMN     "is_late" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "late_minutes" INTEGER,
ADD COLUMN     "status" "public"."AttendanceStatus" NOT NULL DEFAULT 'PRESENT';
