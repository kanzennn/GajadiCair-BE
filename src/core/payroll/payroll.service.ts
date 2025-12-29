import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

import { CompanyService } from '../company/company.service';
import { EmployeeService } from '../employee/employee.service';

type AttendanceRow = {
  status: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'SICK' | '-';
  late_minutes: number | null;
};

type EmployeePayrollRow = {
  employee_id: string;
  name: string;
  email: string;
  base_salary: number;
  attendances: AttendanceRow[];
};

type AllowanceRuleRow = {
  name: string;
  percentage: number | null;
  fixed_amount: number | null;
};

type DeductionRuleRow = {
  name: string;
  type: 'ABSENT' | 'LATE';
  percentage: number | null;
  fixed_amount: number | null;
  per_minute: boolean;
  max_minutes: number | null;
};

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyService: CompanyService,
    private readonly employeeService: EmployeeService,
  ) {}

  private getCurrentPeriod() {
    const now = new Date();

    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  async getCompanyPayrollSummary(companyId: string, employeeId?: string) {
    const { start, end } = this.getCurrentPeriod();

    const [employees, allowances, deductions] = await Promise.all([
      this.prisma.employee.findMany({
        where: {
          company_id: companyId,
          deleted_at: null,
          ...(employeeId ? { employee_id: employeeId } : {}),
        },
        select: {
          employee_id: true,
          name: true,
          email: true,
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
      }) as unknown as Promise<EmployeePayrollRow[]>,

      this.prisma.payrollAllowanceRule.findMany({
        where: { company_id: companyId, is_active: true, deleted_at: null },
        select: { name: true, percentage: true, fixed_amount: true },
      }) as unknown as Promise<AllowanceRuleRow[]>,

      this.prisma.payrollDeductionRule.findMany({
        where: { company_id: companyId, is_active: true, deleted_at: null },
        select: {
          name: true,
          type: true,
          percentage: true,
          fixed_amount: true,
          per_minute: true,
          max_minutes: true,
        },
      }) as unknown as Promise<DeductionRuleRow[]>,
    ]);

    return employees.map((emp) =>
      this.calculatePayroll({
        employee: emp,
        allowances,
        deductions,
        period: { start, end },
      }),
    );
  }

  private calculatePayroll(params: {
    employee: EmployeePayrollRow;
    allowances: AllowanceRuleRow[];
    deductions: DeductionRuleRow[];
    period: { start: Date; end: Date };
  }) {
    const { employee, allowances, deductions, period } = params;

    const baseSalary = employee.base_salary ?? 0;

    // ================= ALLOWANCE =================
    const allowanceDetails = allowances.map((a) => {
      const amount = a.fixed_amount ?? (baseSalary * (a.percentage ?? 0)) / 100;

      return { name: a.name, amount };
    });

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
        const cappedMinutes =
          d.max_minutes != null
            ? Math.min(lateMinutes, d.max_minutes)
            : lateMinutes;

        if (d.per_minute) {
          amount = cappedMinutes * (d.fixed_amount ?? 0);
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
      email: employee.email,

      period,

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
        company_id: true,
      },
    });

    if (!employee) throw new BadRequestException('Employee not found');

    const res = await this.getCompanyPayrollSummary(
      employee.company_id,
      employee.employee_id,
    );

    return res[0] ?? null;
  }

  async getAllPayrollLogByCompany(companyId: string) {
    const company = await this.companyService.getCompanyById(companyId);
    if (!company) throw new BadRequestException('Company not found');

    return this.prisma.payrollLog.findMany({
      where: {
        employee: { company_id: companyId, deleted_at: null },
        deleted_at: null,
      },
      include: {
        employee: {
          select: {
            employee_id: true,
            name: true,
            email: true,
            avatar_uri: true,
          },
        },
        payroll_details: true,
      },
      orderBy: { payroll_date: 'desc' },
    });
  }

  async getAllPayrollLogByEmployee(employeeId: string) {
    const employee = await this.employeeService.getEmployeeById(employeeId);
    if (!employee) throw new BadRequestException('Employee not found');

    return this.prisma.payrollLog.findMany({
      where: { employee_id: employeeId, deleted_at: null },
      include: {
        employee: {
          select: {
            employee_id: true,
            name: true,
            email: true,
            avatar_uri: true,
          },
        },
        payroll_details: true,
      },
      orderBy: { payroll_date: 'desc' },
    });
  }

  async getOnePayrollLog(payrollLogId: string) {
    const payrollLog = await this.prisma.payrollLog.findFirst({
      where: { payroll_log_id: payrollLogId, deleted_at: null },
      include: {
        employee: {
          select: {
            company_id: true,
            employee_id: true,
            name: true,
            email: true,
            avatar_uri: true,
          },
        },
        payroll_details: true,
      },
    });

    if (!payrollLog) throw new BadRequestException('Payroll log not found');
    return payrollLog;
  }
}
