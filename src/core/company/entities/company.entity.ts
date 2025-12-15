import { Employee } from '../../employee/entities/employee.entity';

export class Company {
  company_id: string;
  email: string;
  name?: string;
  password?: string;
  avatar_uri?: string;

  level_plan: number; // 0: free, 1: basic, 2: pro
  plan_expiration?: Date | null;

  minimum_hours_per_day?: number | null;
  attendance_open_time?: Date | null;
  attendance_close_time?: Date | null;
  work_start_time?: Date | null;
  work_end_time?: Date | null;
  attendance_tolerance_minutes?: number | null;
  payroll_day_of_month?: number | null;

  attendance_location_enabled?: boolean | null;
  attendance_location?: string | null;
  attendance_radius_meters?: number | null;

  last_login?: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;

  // Relations
  //   subscription_transactions_histories?: CompanySubscriptionTransactionHistory[];
  //   socialites?: CompanySocialite[];
  employees?: Employee[];
  //   payroll_deduction_rules?: PayrollDeductionRule[];
  //   payroll_allowance_rules?: PayrollAllowanceRule[];
}
