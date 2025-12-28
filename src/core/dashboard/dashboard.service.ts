import { Injectable } from '@nestjs/common';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { startOfDay } from 'src/utils/date.utils';
import { ChartQueryDto } from './dto/chart-query.dto';

type Granularity = 'day' | 'week' | 'month';
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDataDashboardByCompany(companyId: string) {
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

  async getDataChartByCompany(companyId: string, query: ChartQueryDto) {
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
        present: number;
        late: number;
        absent: number;
        leave: number;
        sick: number;
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
        COALESCE(SUM(CASE WHEN ea.status = 'PRESENT' AND ea.is_late = false THEN 1 ELSE 0 END), 0)::int AS present,
        COALESCE(SUM(CASE WHEN ea.status = 'PRESENT' AND ea.is_late = true  THEN 1 ELSE 0 END), 0)::int AS late,
        COALESCE(SUM(CASE WHEN ea.status = 'ABSENT' THEN 1 ELSE 0 END), 0)::int AS absent,
        COALESCE(SUM(CASE WHEN ea.status = 'LEAVE'  THEN 1 ELSE 0 END), 0)::int AS leave,
        COALESCE(SUM(CASE WHEN ea.status = 'SICK'   THEN 1 ELSE 0 END), 0)::int AS sick,
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
        PRESENT: rows.map((r) => r.present),
        LATE: rows.map((r) => r.late),
        ABSENT: rows.map((r) => r.absent),
        LEAVE: rows.map((r) => r.leave),
        SICK: rows.map((r) => r.sick),
        total: rows.map((r) => r.total),
      },
      points: rows.map((r, i) => ({
        period: labels[i],
        PRESENT: r.present,
        LATE: r.late,
        ABSENT: r.absent,
        LEAVE: r.leave,
        SICK: r.sick,
        total: r.total,
      })),
    };
  }

  async getDataDashboardByEmployee(employeeId: string) {
    const today = startOfDay(); // pastikan ini date-only konsisten dengan attendance_date

    // 1) Employee + Company settings
    const employee = await this.prisma.employee.findFirst({
      where: { employee_id: employeeId, deleted_at: null },
      select: {
        employee_id: true,
        name: true,
        email: true,
        username: true,
        avatar_uri: true,
        is_face_enrolled: true,
        company: {
          select: {
            company_id: true,
            name: true,
            company_identifier: true,
            attendance_open_time: true,
            attendance_close_time: true,
            work_start_time: true,
            attendance_tolerance_minutes: true,
            minimum_hours_per_day: true,
            payroll_day_of_month: true,
            recognize_with_gesture: true,
          },
        },
      },
    });

    // kalau employeeId dari token harusnya valid, tapi tetap aman
    if (!employee) {
      return {
        today: null,
        company: null,
        summary_month: null,
        recent_attendances: [],
        leave_applications: { pending: 0 },
        payroll: { latest: null },
      };
    }

    // 2) Today attendance
    const todayAttendance = await this.prisma.employeeAttendance.findFirst({
      where: {
        employee_id: employeeId,
        attendance_date: today,
        deleted_at: null,
      },
      select: {
        attendance_date: true,
        status: true,
        check_in_time: true,
        check_out_time: true,
        is_late: true,
        late_minutes: true,
        total_work_hours: true,
      },
    });

    // 3) Summary bulan ini (PRESENT/LATE/ABSENT/LEAVE/SICK)
    // pakai date range awal bulan -> akhir bulan (UTC)
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    ); // exclusive

    const monthAgg = await this.prisma.employeeAttendance.groupBy({
      by: ['status', 'is_late'],
      where: {
        employee_id: employeeId,
        deleted_at: null,
        attendance_date: { gte: monthStart, lt: monthEnd },
      },
      _count: { _all: true },
    });

    const summary = {
      PRESENT: 0,
      LATE: 0,
      ABSENT: 0,
      LEAVE: 0,
      SICK: 0,
      total_days: 0,
    };

    for (const row of monthAgg) {
      const c = row._count._all;
      summary.total_days += c;

      if (row.status === 'PRESENT' && row.is_late) summary.LATE += c;
      else if (row.status === 'PRESENT') summary.PRESENT += c;
      else if (row.status === 'ABSENT') summary.ABSENT += c;
      else if (row.status === 'LEAVE') summary.LEAVE += c;
      else if (row.status === 'SICK') summary.SICK += c;
    }

    // 4) Recent attendances (7–10 hari terakhir)
    const recent_attendances = await this.prisma.employeeAttendance.findMany({
      where: { employee_id: employeeId, deleted_at: null },
      orderBy: { attendance_date: 'desc' },
      take: 10,
      select: {
        attendance_date: true,
        status: true,
        check_in_time: true,
        check_out_time: true,
        is_late: true,
        late_minutes: true,
        total_work_hours: true,
      },
    });

    // 5) Leave applications pending
    const pendingLeave = await this.prisma.employeeLeaveApplication.count({
      where: { employee_id: employeeId, deleted_at: null, status: 0 },
    });

    // 6) Payroll latest
    const latestPayroll = await this.prisma.payrollLog.findFirst({
      where: { employee_id: employeeId, deleted_at: null },
      orderBy: { payroll_date: 'desc' },
      select: { payroll_date: true, amount: true, pdf_uri: true },
    });

    const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
    const fmtDateTime = (d?: Date | null) => (d ? d.toISOString() : null);

    return {
      today: {
        date: fmtDate(today),
        status: todayAttendance?.status ?? null,
        check_in_time: fmtDateTime(todayAttendance?.check_in_time),
        check_out_time: fmtDateTime(todayAttendance?.check_out_time),
        is_late: todayAttendance?.is_late ?? false,
        late_minutes: todayAttendance?.late_minutes ?? null,
        total_work_hours: todayAttendance?.total_work_hours ?? null,
        has_checked_in: !!todayAttendance?.check_in_time,
        has_checked_out: !!todayAttendance?.check_out_time,
      },
      company: employee.company,
      summary_month: {
        month: `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}`,
        ...summary,
      },
      recent_attendances: recent_attendances
        .map((r) => ({
          attendance_date: fmtDate(r.attendance_date!),
          status: r.status,
          check_in_time: fmtDateTime(r.check_in_time),
          check_out_time: fmtDateTime(r.check_out_time),
          is_late: r.is_late,
          late_minutes: r.late_minutes ?? null,
          total_work_hours: r.total_work_hours ?? null,
        }))
        .reverse(), // biar urut naik di UI (opsional)
      leave_applications: { pending: pendingLeave },
      payroll: {
        latest: latestPayroll
          ? {
              payroll_date: fmtDate(latestPayroll.payroll_date),
              amount: latestPayroll.amount,
              pdf_uri: latestPayroll.pdf_uri ?? null,
            }
          : null,
      },
    };
  }

  async getDataChartByEmployee(employeeId: string, query: ChartQueryDto) {
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
      if (days <= 0) throw new BadRequestException('days must be >= 1');

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

    // 4) Query aggregate (bucket kosong tetap ada)
    const rows = await this.prisma.$queryRaw<
      Array<{
        period: Date;
        present: number;
        late: number;
        absent: number;
        leave: number;
        sick: number;
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
        COALESCE(SUM(CASE WHEN ea.status = 'PRESENT' AND ea.is_late = false THEN 1 ELSE 0 END), 0)::int AS present,
        COALESCE(SUM(CASE WHEN ea.status = 'PRESENT' AND ea.is_late = true  THEN 1 ELSE 0 END), 0)::int AS late,
        COALESCE(SUM(CASE WHEN ea.status = 'ABSENT' THEN 1 ELSE 0 END), 0)::int AS absent,
        COALESCE(SUM(CASE WHEN ea.status = 'LEAVE'  THEN 1 ELSE 0 END), 0)::int AS leave,
        COALESCE(SUM(CASE WHEN ea.status = 'SICK'   THEN 1 ELSE 0 END), 0)::int AS sick,
        COALESCE(COUNT(ea.employee_attendance_id), 0)::int AS total
      FROM buckets b
      LEFT JOIN employee_attendances ea
        ON date_trunc(${truncUnit}::text, ea.attendance_date::timestamp) = b.period
        AND ea.deleted_at IS NULL
        AND ea.employee_id = ${employeeId}
      GROUP BY b.period
      ORDER BY b.period ASC
    `;

    // 5) Labels
    const labels = rows.map((r) => {
      const d = new Date(r.period);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');

      if (granularity === 'day') return `${yyyy}-${mm}-${dd}`;
      if (granularity === 'month') return `${yyyy}-${mm}`;
      return `${yyyy}-${mm}-${dd}`; // week: label start bucket
    });
    console.log(rows[0]);

    // 6) Output
    return {
      granularity,
      range: {
        start: startDate.toISOString().slice(0, 10),
        end: endDate.toISOString().slice(0, 10),
        days: rangeDays,
      },
      labels,
      series: {
        PRESENT: rows.map((r) => r.present),
        LATE: rows.map((r) => r.late),
        ABSENT: rows.map((r) => r.absent),
        LEAVE: rows.map((r) => r.leave),
        SICK: rows.map((r) => r.sick),
        total: rows.map((r) => r.total),
      },
      points: rows.map((r, i) => ({
        period: labels[i],
        PRESENT: r.present,
        LATE: r.late,
        ABSENT: r.absent,
        LEAVE: r.leave,
        SICK: r.sick,
        total: r.total,
      })),
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
}
