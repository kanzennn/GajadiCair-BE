-- CreateEnum
CREATE TYPE "public"."LeaveApplicationType" AS ENUM ('LEAVE', 'SICK');

-- AlterTable
ALTER TABLE "public"."employee_leave_applications" ADD COLUMN     "type" "public"."LeaveApplicationType" NOT NULL DEFAULT 'LEAVE';
