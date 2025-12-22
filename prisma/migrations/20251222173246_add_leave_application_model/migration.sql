-- CreateTable
CREATE TABLE "public"."employee_leave_applications" (
    "employee_leave_application_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 0,
    "attachment_uri" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "employee_leave_applications_pkey" PRIMARY KEY ("employee_leave_application_id")
);

-- AddForeignKey
ALTER TABLE "public"."employee_leave_applications" ADD CONSTRAINT "employee_leave_applications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;
