import { Injectable } from '@nestjs/common';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { startOfDay } from 'src/utils/date.utils';
import { ChartCompanyQueryDto } from './dto/chart-company-query.dto';

type Granularity = 'day' | 'week' | 'month';
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDataDashboard(companyId: string) {
    const employeeCount = await this.prisma.employee.count({
      where: {
        company_id: companyId,
        is_active: true,
        deleted_at: null,
      },
    });

    const today = startOfDay();

    const employeePresentToday = await this.prisma.employeeAttendance.count({
      where: {
        employee: {
          company_id: companyId,
          deleted_at: null,
        },
        attendance_date: today,
        status: 'PRESENT',
      },
    });

    const employeeHasNotCheckInToday = await this.prisma.employee.count({
      where: {
        company_id: companyId,
        is_active: true,
        deleted_at: null,
        attendances: {
          none: {
            attendance_date: today,
          },
        },
      },
    });

    const employeeHasNotCheckedOut = await this.prisma.employeeAttendance.count(
      {
        where: {
          employee: {
            company_id: companyId,
          },
          attendance_date: today,
          check_in_time: { not: null },
          check_out_time: null,
        },
      },
    );

    const attendanceLog = await this.prisma.attendanceLog.findMany({
      where: {
        employee: {
          company_id: companyId,
        },
      },
      include: {
        employee: true,
      },
    });

    return {
      total_employee: employeeCount,
      employeePresentToday: employeePresentToday,
      employeeHasNotCheckInToday: employeeHasNotCheckInToday,
      employeeHasNotCheckedOut: employeeHasNotCheckedOut,
      attendanceLog,
    };
  }

  private parseDateOnly(dateStr: string): Date {
    // dateStr: 'YYYY-MM-DD'
    const d = new Date(`${dateStr}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }
    return d;
  }

  private toUTCDateOnly(d: Date): Date {
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
  }

  private diffDaysInclusive(start: Date, end: Date): number {
    const ms = end.getTime() - start.getTime();
    const days = Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
    return days;
  }

  private pickGranularity(rangeDays: number): Granularity {
    if (rangeDays <= 31) return 'day';
    if (rangeDays <= 180) return 'week';
    return 'month';
  }

  async getDataChart(companyId: string, query: ChartCompanyQueryDto) {
    // 1) Validasi kombinasi parameter
    const hasRange = !!query.start_date || !!query.end_date;
    const hasDays = query.days !== undefined && query.days !== null;

    if (hasRange && hasDays) {
      throw new BadRequestException(
        'Use either (start_date & end_date) OR days, not both.',
      );
    }
    if (
      (query.start_date && !query.end_date) ||
      (!query.start_date && query.end_date)
    ) {
      throw new BadRequestException(
        'start_date and end_date must be provided together.',
      );
    }

    // 2) Tentukan startDate & endDate (UTC date-only)
    let startDate: Date;
    let endDate: Date;

    if (query.start_date && query.end_date) {
      startDate = this.parseDateOnly(query.start_date);
      endDate = this.parseDateOnly(query.end_date);
    } else {
      const days = query.days ?? 7;
      const todayUTC = this.toUTCDateOnly(new Date());
      endDate = todayUTC;

      startDate = new Date(todayUTC);
      startDate.setUTCDate(startDate.getUTCDate() - (days - 1));
    }

    if (startDate > endDate) {
      throw new BadRequestException('start_date must be <= end_date');
    }

    const rangeDays = this.diffDaysInclusive(startDate, endDate);
    const granularity = this.pickGranularity(rangeDays);

    // 3) Setup bucket query (generate_series + date_trunc)
    const truncUnit = granularity; // day | week | month
    const step =
      granularity === 'day'
        ? '1 day'
        : granularity === 'week'
          ? '1 week'
          : '1 month';

    // 4) Query aggregate (fill missing bucket)
    const rows = await this.prisma.$queryRaw<
      Array<{
        period: Date;
        PRESENT: number;
        LATE: number;
        ABSENT: number;
        LEAVE: number;
        SICK: number;
        total: number;
      }>
    >`
      WITH buckets AS (
        SELECT generate_series(
          date_trunc(${truncUnit}::text, ${startDate}::timestamp),
          date_trunc(${truncUnit}::text, ${endDate}::timestamp),
          ${step}::interval
        ) AS period
      )
      SELECT
        b.period,
        COALESCE(SUM(CASE WHEN ea.status = 'PRESENT' AND ea.is_late = false THEN 1 ELSE 0 END), 0)::int AS PRESENT,
        COALESCE(SUM(CASE WHEN ea.status = 'PRESENT' AND ea.is_late = true  THEN 1 ELSE 0 END), 0)::int AS LATE,
        COALESCE(SUM(CASE WHEN ea.status = 'ABSENT' THEN 1 ELSE 0 END), 0)::int AS ABSENT,
        COALESCE(SUM(CASE WHEN ea.status = 'LEAVE'  THEN 1 ELSE 0 END), 0)::int AS LEAVE,
        COALESCE(SUM(CASE WHEN ea.status = 'SICK'   THEN 1 ELSE 0 END), 0)::int AS SICK,
        COALESCE(COUNT(ea.employee_attendance_id), 0)::int AS total
      FROM buckets b
      LEFT JOIN employee_attendances ea
        ON date_trunc(${truncUnit}::text, ea.attendance_date::timestamp) = b.period
        AND ea.deleted_at IS NULL
      LEFT JOIN employees e
        ON e.employee_id = ea.employee_id
        AND e.company_id = ${companyId}
        AND e.deleted_at IS NULL
      WHERE
        (ea.employee_attendance_id IS NULL OR e.employee_id IS NOT NULL)
      GROUP BY b.period
      ORDER BY b.period ASC
    `;

    // 5) Buat label untuk chart
    const labels = rows.map((r) => {
      const d = new Date(r.period);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');

      if (granularity === 'day') return `${yyyy}-${mm}-${dd}`;
      if (granularity === 'month') return `${yyyy}-${mm}`;

      // week: pakai tanggal awal bucket minggu (simple & konsisten)
      return `${yyyy}-${mm}-${dd}`;
    });

    // 6) Format output
    return {
      granularity, // 'day' | 'week' | 'month'
      range: {
        start: startDate.toISOString().slice(0, 10),
        end: endDate.toISOString().slice(0, 10),
        days: rangeDays,
      },
      labels,
      series: {
        PRESENT: rows.map((r) => r.PRESENT),
        LATE: rows.map((r) => r.LATE),
        ABSENT: rows.map((r) => r.ABSENT),
        LEAVE: rows.map((r) => r.LEAVE),
        SICK: rows.map((r) => r.SICK),
        total: rows.map((r) => r.total),
      },
      points: rows.map((r, i) => ({
        period: labels[i],
        PRESENT: r.PRESENT,
        LATE: r.LATE,
        ABSENT: r.ABSENT,
        LEAVE: r.LEAVE,
        SICK: r.SICK,
        total: r.total,
      })),
    };
  }
}
