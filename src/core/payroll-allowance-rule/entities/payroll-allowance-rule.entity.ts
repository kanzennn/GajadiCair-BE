export class PayrollAllowanceRule {
  payroll_allowance_rule_id: string;
  company_id: string;

  name: string;
  percentage: number | null;
  fixed_amount: number | null;

  is_active: boolean;

  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}
