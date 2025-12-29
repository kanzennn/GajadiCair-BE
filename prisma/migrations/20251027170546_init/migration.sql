-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateTable
CREATE TABLE "public"."companies" (
    "company_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT,
    "avatar_uri" TEXT,
    "level_plan" INTEGER NOT NULL DEFAULT 0,
    "plan_expiration" TIMESTAMP(3),
    "minimum_hours_per_day" INTEGER,
    "attendance_open_time" TIMESTAMP(3),
    "attendance_close_time" TIMESTAMP(3),
    "work_start_time" TIMESTAMP(3),
    "work_end_time" TIMESTAMP(3),
    "attendance_tolerance_minutes" INTEGER,
    "payroll_day_of_month" INTEGER,
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("company_id")
);

-- CreateTable
CREATE TABLE "public"."payroll_deduction_rules" (
    "payroll_deduction_rule_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION,
    "fixed_amount" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payroll_deduction_rules_pkey" PRIMARY KEY ("payroll_deduction_rule_id")
);

-- CreateTable
CREATE TABLE "public"."payroll_allowance_rules" (
    "payroll_allowance_rule_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION,
    "fixed_amount" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payroll_allowance_rules_pkey" PRIMARY KEY ("payroll_allowance_rule_id")
);

-- CreateTable
CREATE TABLE "public"."company_socialites" (
    "company_socialite_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "socialite_name" TEXT NOT NULL,
    "socialite_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "company_socialites_pkey" PRIMARY KEY ("company_socialite_id")
);

-- CreateTable
CREATE TABLE "public"."company_subscription_transaction_histories" (
    "company_subscription_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "midtrans_transaction_id" TEXT NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "gross_amount" DOUBLE PRECISION NOT NULL,
    "midtrans_admin_fee" DOUBLE PRECISION NOT NULL,
    "midtrans_status" TEXT NOT NULL,
    "midtrans_payment_method" TEXT NOT NULL,
    "midtrans_transaction_token" TEXT NOT NULL,
    "midtrans_redirect_url" TEXT NOT NULL,
    "midtrans_paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "company_subscription_transaction_histories_pkey" PRIMARY KEY ("company_subscription_id")
);

-- CreateTable
CREATE TABLE "public"."banks" (
    "bank_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "banks_pkey" PRIMARY KEY ("bank_id")
);

-- CreateTable
CREATE TABLE "public"."employees" (
    "employee_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "base_salary" DOUBLE PRECISION NOT NULL,
    "face_id" TEXT,
    "bank_id" TEXT,
    "bank_account_number" TEXT,
    "tax_identification_number" TEXT,
    "avatar_uri" TEXT,
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("employee_id")
);

-- CreateTable
CREATE TABLE "public"."employee_attendances" (
    "employee_attendance_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "attendance_date" TIMESTAMP(3) NOT NULL,
    "check_in_time" TIMESTAMP(3) NOT NULL,
    "check_in_location" geography NOT NULL,
    "check_out_time" TIMESTAMP(3),
    "check_out_location" geography,
    "total_work_hours" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "employee_attendances_pkey" PRIMARY KEY ("employee_attendance_id")
);

-- CreateTable
CREATE TABLE "public"."payroll_logs" (
    "payroll_log_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "payroll_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payroll_logs_pkey" PRIMARY KEY ("payroll_log_id")
);

-- CreateTable
CREATE TABLE "public"."payroll_details" (
    "payroll_detail_id" TEXT NOT NULL,
    "payroll_log_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payroll_details_pkey" PRIMARY KEY ("payroll_detail_id")
);

-- CreateTable
CREATE TABLE "public"."attendance_logs" (
    "attendance_log_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "log_type" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "attendance_logs_pkey" PRIMARY KEY ("attendance_log_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_socialites_socialite_name_socialite_id_key" ON "public"."company_socialites"("socialite_name", "socialite_id");

-- CreateIndex
CREATE UNIQUE INDEX "banks_code_key" ON "public"."banks"("code");

-- CreateIndex
CREATE UNIQUE INDEX "employee_attendances_employee_id_attendance_date_key" ON "public"."employee_attendances"("employee_id", "attendance_date");

-- AddForeignKey
ALTER TABLE "public"."payroll_deduction_rules" ADD CONSTRAINT "payroll_deduction_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll_allowance_rules" ADD CONSTRAINT "payroll_allowance_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."company_socialites" ADD CONSTRAINT "company_socialites_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."company_subscription_transaction_histories" ADD CONSTRAINT "company_subscription_transaction_histories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("bank_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employee_attendances" ADD CONSTRAINT "employee_attendances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll_logs" ADD CONSTRAINT "payroll_logs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll_details" ADD CONSTRAINT "payroll_details_payroll_log_id_fkey" FOREIGN KEY ("payroll_log_id") REFERENCES "public"."payroll_logs"("payroll_log_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attendance_logs" ADD CONSTRAINT "attendance_logs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;
