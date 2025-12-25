import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { PayrollAllowanceRule } from '../payroll-allowance-rule/entities/payroll-allowance-rule.entity';
import { PayrollDeductionRule } from '../payroll-deduction-rule/entities/payroll-deduction-rule.entity';
import { Employee } from '../employee/entities/employee.entity';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  private getPeriod() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  async getCompanyPayrollSummary(companyId: string, employeeId?: string) {
    const { start, end } = this.getPeriod();

    const employees = await this.prisma.employee.findMany({
      where: {
        company_id: companyId,
        deleted_at: null,
        ...(employeeId ? { employee_id: employeeId } : {}),
      },
      select: {
        employee_id: true,
        name: true,
        base_salary: true,
        attendances: {
          where: {
            deleted_at: null,
            attendance_date: { gte: start, lte: end },
          },
          select: {
            status: true,
            late_minutes: true,
          },
        },
      },
    });

    const allowances = await this.prisma.payrollAllowanceRule.findMany({
      where: { company_id: companyId, is_active: true, deleted_at: null },
    });

    const deductions = await this.prisma.payrollDeductionRule.findMany({
      where: { company_id: companyId, is_active: true, deleted_at: null },
    });

    return employees.map((emp) =>
      this.calculatePayroll(emp, allowances, deductions, start, end),
    );
  }

  private calculatePayroll(
    employee: Employee,
    allowances: PayrollAllowanceRule[],
    deductions: PayrollDeductionRule[],
    start: Date,
    end: Date,
  ) {
    const baseSalary = employee.base_salary;

    // ================= ALLOWANCE =================
    const allowanceDetails = allowances.map((a) => ({
      name: a.name,
      amount: a.fixed_amount ?? (baseSalary * (a.percentage ?? 0)) / 100,
    }));

    const totalAllowance = allowanceDetails.reduce(
      (sum, a) => sum + a.amount,
      0,
    );

    // ================= ATTENDANCE =================
    const absentDays = employee.attendances.filter(
      (a) => a.status === 'ABSENT',
    ).length;

    const lateMinutes = employee.attendances.reduce(
      (sum, a) => sum + (a.late_minutes ?? 0),
      0,
    );

    // ================= DEDUCTION =================
    const deductionDetails = deductions.map((d) => {
      let amount = 0;

      if (d.type === 'ABSENT' && absentDays > 0) {
        const perDay =
          d.fixed_amount ?? (baseSalary * (d.percentage ?? 0)) / 100;
        amount = absentDays * perDay;
      }

      if (d.type === 'LATE' && lateMinutes > 0) {
        if (d.per_minute) {
          amount = lateMinutes * (d.fixed_amount ?? 0);
        } else {
          amount = d.fixed_amount ?? (baseSalary * (d.percentage ?? 0)) / 100;
        }
      }

      return { name: d.name, type: d.type, amount };
    });

    const totalDeduction = deductionDetails.reduce(
      (sum, d) => sum + d.amount,
      0,
    );

    return {
      employee_id: employee.employee_id,
      name: employee.name,
      period: {
        start,
        end,
      },
      base_salary: baseSalary,
      attendance: {
        absent_days: absentDays,
        late_minutes: lateMinutes,
      },
      allowance: {
        total: totalAllowance,
        details: allowanceDetails,
      },
      deduction: {
        total: totalDeduction,
        details: deductionDetails,
      },
      take_home_pay: baseSalary + totalAllowance - totalDeduction,
    };
  }

  async getEmployeePayroll(employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { employee_id: employeeId, deleted_at: null },
      select: {
        employee_id: true,
        name: true,
        base_salary: true,
        company_id: true,
      },
    });

    if (!employee) {
      throw new BadRequestException('Employee not found');
    }

    const companyPayroll = await this.getCompanyPayrollSummary(
      employee.company_id,
      employee.employee_id,
    );

    return companyPayroll[0]; // cuma 1 employee
  }
}
