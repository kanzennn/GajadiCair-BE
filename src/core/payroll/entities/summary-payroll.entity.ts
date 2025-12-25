import { PayrollDeductionType } from 'generated/prisma';

export class SummaryPayroll {
  employee_id: string;
  name: string | undefined;
  period: {
    start: Date;
    end: Date;
  };
  base_salary: number;
  attendance: {
    absent_days: number;
    late_minutes: number;
  };
  allowance: {
    total: number;
    details: {
      name: string;
      amount: number;
    }[];
  };
  deduction: {
    total: number;
    details: {
      name: string;
      type: PayrollDeductionType;
      amount: number;
    }[];
  };
  take_home_pay: number;
}
