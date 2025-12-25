import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { PayrollService } from 'src/core/payroll/payroll.service';
import { SummaryPayroll } from 'src/core/payroll/entities/summary-payroll.entity';
import { PayrollDetailType } from 'generated/prisma';
import { formatCurrency } from 'src/utils/currency.utils';
import { CustomMailerService } from 'src/common/services/mailer/mailer.service';

@Injectable()
export class PayrollJobService {
  private readonly logger = new Logger(PayrollJobService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payrollService: PayrollService,
    private readonly mailer: CustomMailerService,
  ) {}

  // =============================
  // PRODUKSI
  // @Cron('0 1 * * *', { timeZone: 'Asia/Jakarta' })

  // DEV (tiap 10 detik)
  @Cron('*/10 * * * * *')
  async runMonthlyPayroll() {
    const now = new Date();
    const todayDate = now.getDate(); // 1–31

    this.logger.log(`Running payroll cron (date=${todayDate})`);

    // 1️⃣ Ambil company yang payroll hari ini
    const companies = await this.prisma.company.findMany({
      where: {
        deleted_at: null,
        payroll_day_of_month: todayDate,
      },
      select: {
        company_id: true,
        name: true,
      },
    });

    if (companies.length === 0) {
      this.logger.log('No company scheduled for payroll today');
      return;
    }

    for (const company of companies) {
      try {
        await this.processCompanyPayroll(company.company_id, company.name, now);
      } catch (err) {
        this.logger.error(
          `Payroll failed for company ${company.company_id}`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  // =============================
  // PROCESS PER COMPANY
  private async processCompanyPayroll(
    companyId: string,
    companyName: string,
    now: Date,
  ) {
    this.logger.log(`Processing payroll for company ${companyId}`);

    // 2️⃣ Periode payroll = bulan berjalan
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    periodStart.setHours(0, 0, 0, 0);

    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    periodEnd.setHours(23, 59, 59, 999);

    // 3️⃣ Ambil summary payroll (SEMUA employee)
    const payrollSummaries =
      await this.payrollService.getCompanyPayrollSummary(companyId);

    for (const summary of payrollSummaries) {
      // 4️⃣ Idempotent check
      const alreadyPaid = await this.prisma.payrollLog.findFirst({
        where: {
          employee_id: summary.employee_id,
          payroll_date: {
            gte: periodStart,
            lte: periodEnd,
          },
          deleted_at: null,
        },
      });

      if (alreadyPaid) {
        this.logger.warn(
          `Payroll already exists for employee ${summary.employee_id}`,
        );
        continue;
      }

      // 5️⃣ Create payroll + details
      await this.createPayrollLog(summary, now);

      // 6️⃣ Kirim email slip gaji
      await this.sendPayrollEmail(summary, companyName, now);
    }
  }

  // =============================
  // CREATE PAYROLL LOG
  private async createPayrollLog(summary: SummaryPayroll, payrollDate: Date) {
    await this.prisma.$transaction(async (tx) => {
      // Payroll Log
      const payrollLog = await tx.payrollLog.create({
        data: {
          employee_id: summary.employee_id,
          amount: summary.take_home_pay,
          payroll_date: payrollDate,
        },
      });

      // Payroll Details
      const details = [
        // Base salary
        {
          payroll_log_id: payrollLog.payroll_log_id,
          description: 'Base Salary',
          type: PayrollDetailType.BASE_SALARY,
          amount: summary.base_salary,
        },

        // Allowances
        ...summary.allowance.details.map((a) => ({
          payroll_log_id: payrollLog.payroll_log_id,
          description: a.name,
          type: PayrollDetailType.ALLOWANCE,
          amount: a.amount,
        })),

        // Deductions (NEGATIVE)
        ...summary.deduction.details.map((d) => ({
          payroll_log_id: payrollLog.payroll_log_id,
          description: d.name,
          type: PayrollDetailType.DEDUCTION,
          amount: -Math.abs(d.amount),
        })),
      ];

      await tx.payrollDetail.createMany({
        data: details,
      });
    });
  }

  // =============================
  // SEND EMAIL
  private async sendPayrollEmail(
    summary: SummaryPayroll,
    companyName: string,
    payrollDate: Date,
  ) {
    try {
      const monthName = payrollDate.toLocaleString('id-ID', {
        month: 'long',
        year: 'numeric',
      });

      await this.mailer.sendTemplatedEmail(
        summary.email,
        `Slip Gaji ${monthName} - ${companyName}`,
        'payroll-notification',
        {
          employee_name: summary.name,
          company_name: companyName,

          payroll_date: payrollDate.toISOString().slice(0, 10),
          period: {
            start: summary.period.start.toISOString().slice(0, 10),
            end: summary.period.end.toISOString().slice(0, 10),
          },

          base_salary: formatCurrency(summary.base_salary),

          attendance: {
            absent_days: summary.attendance.absent_days,
            late_minutes: summary.attendance.late_minutes,
          },

          allowance: {
            total: formatCurrency(summary.allowance.total),
            details: summary.allowance.details.map((a) => ({
              name: a.name,
              amount: formatCurrency(a.amount),
            })),
          },

          deduction: {
            total: formatCurrency(summary.deduction.total),
            details: summary.deduction.details.map((d) => ({
              name: d.name,
              type: d.type,
              amount: formatCurrency(d.amount),
            })),
          },

          take_home_pay: formatCurrency(summary.take_home_pay),
        },
      );

      this.logger.log(
        `Payroll email sent to ${summary.email} (${summary.employee_id})`,
      );
    } catch (err) {
      // ❗ jangan gagalkan payroll
      this.logger.error(
        `Failed to send payroll email to ${summary.email}`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}
