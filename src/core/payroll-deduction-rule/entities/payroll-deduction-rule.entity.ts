import { PayrollDeductionType } from 'generated/prisma';

export class PayrollDeductionRule {
  payroll_deduction_rule_id: string;
  company_id: string;

  name: string;
  type: PayrollDeductionType;

  percentage: number | null;
  fixed_amount: number | null;

  // khusus telat
  per_minute: boolean;
  max_minutes: number | null;

  is_active: boolean;

  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}
