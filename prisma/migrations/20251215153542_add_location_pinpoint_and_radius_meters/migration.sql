-- AlterTable
ALTER TABLE "public"."companies" ADD COLUMN     "attendance_location" geography,
ADD COLUMN     "attendance_radius_meters" INTEGER;
