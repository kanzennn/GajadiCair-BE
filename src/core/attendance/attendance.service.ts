import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

import { FaceRecognitionService } from '../face-recognition/face-recognition.service';
import { EmployeeService } from '../employee/employee.service';
import { CompanyService } from '../company/company.service';
import { SubscriptionService } from '../subscription/subscription.service';

import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { UpdateAttendanceSettingDto } from './dto/update-attendance-setting.dto';
import { AttendanceSummaryQueryDto } from './dto/attendance-summary-query.dto';
import { AttendanceByCompanyQueryDto } from './dto/attendance-by-company-query.dto';
import { UpdateAttendanceByCompanyDto } from './dto/update-attendance-by-company';
import { AttendanceSummaryByEmployeeQueryDto } from './dto/attendance-summary-by-employee-query.dto';

import {
  addDaysUtc,
  dateOnlyUtc,
  nowMinutesJakarta,
  parseIsoDateOrTodayUtc,
  startOfDay,
  timeToMinutesFromDb,
  toYmd,
} from 'src/utils/date.utils';
import { Prisma } from 'generated/prisma';

type GeoCheckRow = { has_location: boolean; in_radius: boolean };
type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LEAVE' | 'SICK' | '-';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly faceRecognitionService: FaceRecognitionService,
    private readonly employeeService: EmployeeService,
    private readonly companyService: CompanyService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  // ===================== CHECK-IN / CHECK-OUT =====================

  async checkInFace(
    file: Express.Multer.File,
    employeeId: string,
    dto: CheckInDto,
  ) {
    const today = startOfDay();
    const now = new Date();
    const nowMin = nowMinutesJakarta(now);

    await this.faceRecognitionService.verifyFace(file, employeeId);

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const { company } = await this.findEmployeeCompanyForCheckIn(
        tx,
        employeeId,
      );

      this.assertAttendanceWindowOpen({
        nowMin,
        openTime: company.attendance_open_time,
        closeTime: company.attendance_close_time,
      });

      await this.assertInRadiusIfEnabled(tx, {
        companyId: company.company_id,
        enabled: company.attendance_location_enabled,
        radiusMeters: company.attendance_radius_meters,
        latitude: Number(dto.latitude),
        longitude: Number(dto.longitude),
      });

      const existing = await tx.employeeAttendance.findFirst({
        where: {
          employee_id: employeeId,
          attendance_date: today,
          deleted_at: null,
        },
        select: { employee_attendance_id: true },
      });

      if (existing) throw new BadRequestException('Already checked in today');

      const { lateMinutes, isLate } = this.calculateLateMinutes(
        now,
        company.work_start_time,
        company.attendance_tolerance_minutes ?? 0,
      );

      const created = await tx.employeeAttendance.create({
        data: {
          employee_id: employeeId,
          attendance_date: today,
          check_in_time: now,
          late_minutes: lateMinutes,
          is_late: isLate,
        },
        select: { employee_attendance_id: true },
      });

      await this.updateAttendanceLocation(tx, {
        employeeAttendanceId: created.employee_attendance_id,
        type: 'check_in',
        latitude: Number(dto.latitude),
        longitude: Number(dto.longitude),
      });

      await tx.attendanceLog.create({
        data: { employee_id: employeeId, log_type: 0 },
      });

      return tx.employeeAttendance.findUnique({
        where: { employee_attendance_id: created.employee_attendance_id },
      });
    });
  }

  async checkOutFace(
    file: Express.Multer.File,
    employeeId: string,
    dto: CheckOutDto,
  ) {
    const now = new Date();

    await this.faceRecognitionService.verifyFace(file, employeeId);

    return this.prisma.$transaction(async (tx) => {
      const { company } = await this.findEmployeeCompanyForCheckOut(
        tx,
        employeeId,
      );

      await this.assertInRadiusIfEnabled(tx, {
        companyId: company.company_id,
        enabled: company.attendance_location_enabled,
        radiusMeters: company.attendance_radius_meters,
        latitude: Number(dto.latitude),
        longitude: Number(dto.longitude),
      });

      const existing = await tx.employeeAttendance.findFirst({
        where: {
          employee_id: employeeId,
          check_out_time: null,
          deleted_at: null,
        },
        orderBy: { attendance_date: 'desc' },
        select: {
          employee_attendance_id: true,
          check_in_time: true,
          is_late: true,
          status: true,
        },
      });

      if (!existing)
        throw new BadRequestException('You have not checked in today');

      if (existing.status !== 'PRESENT') {
        throw new BadRequestException(
          `Cannot checkout because status is ${existing.status}`,
        );
      }

      let totalWorkHours = this.calcEffectiveWorkedHours({
        now,
        checkIn: existing.check_in_time,
        isLate: existing.is_late,
        companyWorkStart: company.work_start_time,
      });

      if (totalWorkHours < 0) totalWorkHours = 0;

      const minHours = company.minimum_hours_per_day ?? 0;
      if (minHours > 0 && totalWorkHours < minHours) {
        throw new BadRequestException(
          `You must work at least ${minHours} hours. You have worked ${totalWorkHours.toFixed(
            2,
          )} hours.`,
        );
      }

      const updated = await tx.employeeAttendance.update({
        where: { employee_attendance_id: existing.employee_attendance_id },
        data: {
          check_out_time: now,
          total_work_hours: totalWorkHours,
        },
        select: { employee_attendance_id: true },
      });

      await this.updateAttendanceLocation(tx, {
        employeeAttendanceId: updated.employee_attendance_id,
        type: 'check_out',
        latitude: Number(dto.latitude),
        longitude: Number(dto.longitude),
      });

      await tx.attendanceLog.create({
        data: { employee_id: employeeId, log_type: 1 },
      });

      return tx.employeeAttendance.findUnique({
        where: { employee_attendance_id: updated.employee_attendance_id },
      });
    });
  }

  // ===================== EMPLOYEE QUERIES =====================

  async getAllAttendance(employeeId: string) {
    return this.prisma.employeeAttendance.findMany({
      where: { employee_id: employeeId, deleted_at: null },
      orderBy: { attendance_date: 'desc' },
    });
  }

  async getTodayAttendanceStatus(employeeId: string) {
    const today = startOfDay();

    return this.prisma.employeeAttendance.findFirst({
      where: {
        employee_id: employeeId,
        attendance_date: today,
        deleted_at: null,
      },
    });
  }

  async canEmployeeCheckOut(employeeId: string) {
    const employee =
      await this.employeeService.getEmployeeByIdIncludeCompany(employeeId);
    if (!employee) throw new BadRequestException('Employee not found');

    const company = employee.company;
    const now = new Date();
    const minHours = company.minimum_hours_per_day ?? 0;

    const attendance = await this.getTodayAttendanceStatus(employeeId);

    if (!attendance) {
      return {
        can_check_out: false,
        min_hours: minHours,
        worked_hours: 0,
        reason: 'Not checked in today',
      };
    }

    if (attendance.check_out_time) {
      return {
        can_check_out: false,
        min_hours: minHours,
        worked_hours: attendance.total_work_hours,
        reason: 'Already checked out today',
      };
    }

    const workedHours = this.calcEffectiveWorkedHours({
      now,
      checkIn: attendance.check_in_time,
      isLate: attendance.is_late,
      companyWorkStart: company.work_start_time,
    });

    if (minHours > 0 && workedHours < minHours) {
      return {
        can_check_out: false,
        min_hours: minHours,
        worked_hours: workedHours,
        reason: `Minimum work hours not met. Required: ${minHours} hours, Worked: ${workedHours.toFixed(
          2,
        )} hours.`,
      };
    }

    return {
      can_check_out: true,
      in_hours: minHours,
      worked_hours: workedHours,
      reason: null,
    };
  }

  async canEmployeeCheckIn(employeeId: string) {
    const employee =
      await this.employeeService.getEmployeeByIdIncludeCompany(employeeId);
    if (!employee) throw new BadRequestException('Employee not found');

    const company = employee.company;
    const now = new Date();
    const nowMin = nowMinutesJakarta(now);

    // window open/close
    if (company.attendance_open_time) {
      const openMin = timeToMinutesFromDb(company.attendance_open_time);
      if (nowMin < openMin) {
        return {
          can_check_in: false,
          remaining_time_until_closed: 0,
          opened_time: company.attendance_open_time,
          closed_time: company.attendance_close_time,
          reason: 'Attendance is not open yet at this time',
        };
      }
    }

    if (company.attendance_close_time) {
      const closeMin = timeToMinutesFromDb(company.attendance_close_time);
      if (nowMin > closeMin) {
        return {
          can_check_in: false,
          remaining_time_until_closed: 0,
          opened_time: company.attendance_open_time,
          closed_time: company.attendance_close_time,
          reason: 'Attendance is already closed',
        };
      }
    }

    const isAlreadyCheckedIn = await this.prisma.employeeAttendance.findFirst({
      where: {
        employee_id: employeeId,
        attendance_date: startOfDay(),
        deleted_at: null,
      },
      select: { employee_attendance_id: true },
    });

    if (isAlreadyCheckedIn) {
      return {
        can_check_in: false,
        remaining_time_until_closed: 0,
        opened_time: company.attendance_open_time,
        closed_time: company.attendance_close_time,
        reason: 'Already checked in today',
      };
    }

    return {
      can_check_in: true,
      remaining_time_until_closed: company.attendance_close_time
        ? timeToMinutesFromDb(company.attendance_close_time) - nowMin
        : null,
      opened_time: company.attendance_open_time,
      closed_time: company.attendance_close_time,
      reason: null,
    };
  }

  // ===================== COMPANY SETTINGS =====================

  async getAttendanceSetting(companyId: string) {
    const setting = await this.prisma.company.findUnique({
      where: { company_id: companyId },
      select: {
        minimum_hours_per_day: true,
        attendance_open_time: true,
        attendance_close_time: true,
        work_start_time: true,
        payroll_day_of_month: true,
        recognize_with_gesture: true,
        attendance_tolerance_minutes: true,
        attendance_location_enabled: true,
        attendance_radius_meters: true,
      },
    });

    const location = await this.getCompanyAttendanceLocation(companyId);

    return {
      ...setting,
      attendance_location: location,
    };
  }

  async updateAttendanceSetting(
    companyId: string,
    dto: Partial<UpdateAttendanceSettingDto>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.recognize_with_gesture === true) {
        const sub =
          await this.subscriptionService.getSubscriptionStatus(companyId);
        if (sub.level_plan < 1) {
          throw new BadRequestException(
            'Feature recognize with gesture is only available for Level 1 plan and above. Please upgrade your subscription.',
          );
        }
      }

      await tx.company.update({
        where: { company_id: companyId },
        data: {
          minimum_hours_per_day: dto.minimum_hours_per_day,
          attendance_tolerance_minutes: dto.attendance_tolerance_minutes,
          payroll_day_of_month: dto.payroll_day_of_month,
          recognize_with_gesture: dto.recognize_with_gesture,
          attendance_location_enabled: dto.attendance_location_enabled,
          attendance_radius_meters: dto.attendance_radius_meters,
        },
      });

      await this.updateCompanyTimeColumns(tx, companyId, dto);

      // location geography
      if (dto.attendance_location_enabled === true) {
        if (dto.latitude == null || dto.longitude == null) {
          throw new BadRequestException(
            'latitude & longitude wajib ketika attendance_location_enabled = true',
          );
        }

        await tx.$executeRaw`
          UPDATE companies
          SET attendance_location =
            ST_SetSRID(
              ST_MakePoint(${dto.longitude}::double precision, ${dto.latitude}::double precision),
              4326
            )::geography
          WHERE company_id = ${companyId}
        `;
      }

      if (dto.attendance_location_enabled === false) {
        await tx.$executeRaw`
          UPDATE companies
          SET attendance_location = NULL
          WHERE company_id = ${companyId}
        `;
      }

      const location = await this.getCompanyAttendanceLocation(companyId, tx);

      const updated = await tx.company.findUnique({
        where: { company_id: companyId },
        select: {
          minimum_hours_per_day: true,
          attendance_open_time: true,
          attendance_close_time: true,
          work_start_time: true,
          attendance_tolerance_minutes: true,
          attendance_location_enabled: true,
          attendance_radius_meters: true,
        },
      });

      return {
        ...updated,
        attendance_location: location,
      };
    });
  }

  // ===================== COMPANY REPORTS =====================

  async getAttendanceSummaryByCompany(
    companyId: string,
    query?: AttendanceSummaryQueryDto,
  ) {
    const company = await this.companyService.getCompanyById(companyId);
    if (!company) throw new BadRequestException('Company not found');

    // default 7 hari (inclusive)
    const today = dateOnlyUtc(new Date());
    const defaultStart = addDaysUtc(today, -6);
    const defaultEnd = today;

    const startDate = query?.start_date
      ? new Date(`${query.start_date}T00:00:00.000Z`)
      : defaultStart;

    const endDate = query?.end_date
      ? new Date(`${query.end_date}T00:00:00.000Z`)
      : defaultEnd;

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid start_date or end_date');
    }
    if (startDate > endDate) {
      throw new BadRequestException(
        'start_date cannot be greater than end_date',
      );
    }

    const start = dateOnlyUtc(startDate);
    const end = dateOnlyUtc(endDate);
    const endExclusive = addDaysUtc(end, 1);

    const employees = await this.prisma.employee.findMany({
      where: { company_id: companyId, deleted_at: null },
      select: {
        employee_id: true,
        name: true,
        email: true,
        avatar_uri: true,
        attendances: {
          where: {
            deleted_at: null,
            attendance_date: { gte: start, lt: endExclusive },
          },
          select: {
            attendance_date: true,
            status: true,
            is_late: true,
            late_minutes: true,
            total_work_hours: true,
            check_in_time: true,
            check_out_time: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const days: string[] = [];
    for (let d = new Date(start); d < endExclusive; d = addDaysUtc(d, 1)) {
      days.push(toYmd(d));
    }

    return {
      range: { start_date: toYmd(start), end_date: toYmd(end) },
      employees: employees.map((emp) => {
        const byDate = new Map<
          string,
          {
            status: string;
            is_late: boolean;
            late_minutes: number | null;
            check_in_time: Date | null;
            check_out_time: Date | null;
          }
        >();

        for (const a of emp.attendances) {
          if (!a.attendance_date) continue;

          byDate.set(toYmd(dateOnlyUtc(a.attendance_date)), {
            status: a.status,
            is_late: a.is_late,
            late_minutes: a.late_minutes,
            check_in_time: a.check_in_time,
            check_out_time: a.check_out_time,
          });
        }

        const summary: Record<AttendanceStatus, number> = {
          PRESENT: 0,
          ABSENT: 0,
          LEAVE: 0,
          SICK: 0,
          '-': 0,
        };

        const attendance_histories = days.map((tanggal) => {
          const record = byDate.get(tanggal);
          const status = (record?.status ?? '-') as AttendanceStatus;

          summary[status] = (summary[status] ?? 0) + 1;

          return {
            tanggal,
            status,
            is_late: record?.is_late ?? false,
            late_minutes: record?.late_minutes ?? 0,
            check_in_time: record?.check_in_time
              ? record.check_in_time.toISOString()
              : null,
            check_out_time: record?.check_out_time
              ? record.check_out_time.toISOString()
              : null,
          };
        });

        return {
          employee_id: emp.employee_id,
          email: emp.email,
          name: emp.name,
          avatar_uri: emp.avatar_uri,
          attendance_histories,
          summary,
        };
      }),
    };
  }

  async getAttendanceByCompany(
    companyId: string,
    query?: AttendanceByCompanyQueryDto,
  ) {
    const company = await this.companyService.getCompanyById(companyId);
    if (!company) throw new BadRequestException('Company not found');

    const day = parseIsoDateOrTodayUtc(query?.date);

    const employees = await this.prisma.employee.findMany({
      where: {
        company_id: companyId,
        deleted_at: null,
        attendances: {
          some: {
            attendance_date: day,
            deleted_at: null,
          },
        },
      },
      select: {
        employee_id: true,
        name: true,
        email: true,
        avatar_uri: true,
        attendances: {
          where: { deleted_at: null, attendance_date: day },
          select: {
            employee_attendance_id: true,
            attendance_date: true,
            status: true,
            is_late: true,
            late_minutes: true,
            check_in_time: true,
            check_out_time: true,
            total_work_hours: true,
            absent_reason: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return {
      date: day.toISOString().slice(0, 10),
      employees: employees.map((e) => ({
        employee_id: e.employee_id,
        name: e.name,
        email: e.email,
        avatar_uri: e.avatar_uri,
        attendance: e.attendances[0] ?? null,
      })),
    };
  }

  async updateAttendanceByCompany(
    companyId: string,
    dto: UpdateAttendanceByCompanyDto,
  ) {
    const company = await this.companyService.getCompanyById(companyId);
    if (!company) throw new BadRequestException('Company not found');

    const attendance = await this.prisma.employeeAttendance.findFirst({
      where: {
        employee_attendance_id: dto.employee_attendance_id,
        deleted_at: null,
        employee: { company_id: companyId },
      },
      include: { employee: true },
    });

    if (!attendance)
      throw new BadRequestException('Attendance not found for this company');

    const checkIn = dto.check_in_time ? new Date(dto.check_in_time) : null;
    const checkOut = dto.check_out_time ? new Date(dto.check_out_time) : null;

    if (checkIn && checkOut && checkOut < checkIn) {
      throw new BadRequestException(
        'check_out_time cannot be earlier than check_in_time',
      );
    }

    if (
      ['ABSENT', 'LEAVE', 'SICK'].includes(dto.status) &&
      (checkIn || checkOut)
    ) {
      throw new BadRequestException(
        `${dto.status} attendance cannot have check-in or check-out time`,
      );
    }

    const isLate =
      dto.late_minutes !== undefined
        ? dto.late_minutes > 0
        : (dto.is_late ?? false);

    return this.prisma.employeeAttendance.update({
      where: { employee_attendance_id: dto.employee_attendance_id },
      data: {
        status: dto.status,
        check_in_time: checkIn,
        check_out_time: checkOut,
        is_late: isLate,
        late_minutes: dto.late_minutes ?? null,
        absent_reason: dto.absent_reason ?? null,
      },
    });
  }

  async getAttendanceSummaryByEmployee(
    employeeId: string,
    query?: AttendanceSummaryByEmployeeQueryDto,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { employee_id: employeeId, deleted_at: null },
      select: {
        employee_id: true,
        name: true,
        email: true,
        avatar_uri: true,
      },
    });

    if (!employee) throw new BadRequestException('Employee not found');

    const now = new Date();
    const year = query?.year ?? now.getUTCFullYear();
    const month = query?.month ?? now.getUTCMonth() + 1;

    if (month < 1 || month > 12) throw new BadRequestException('Invalid month');

    const start = new Date(Date.UTC(year, month - 1, 1));
    const endExclusive = new Date(Date.UTC(year, month, 1));

    const attendances = await this.prisma.employeeAttendance.findMany({
      where: {
        employee_id: employeeId,
        deleted_at: null,
        attendance_date: { gte: start, lt: endExclusive },
      },
      select: {
        attendance_date: true,
        status: true,
        is_late: true,
        late_minutes: true,
        total_work_hours: true,
        check_in_time: true,
        check_out_time: true,
      },
    });

    const days: string[] = [];
    for (
      let d = new Date(start);
      d < endExclusive;
      d = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1),
      )
    ) {
      days.push(d.toISOString().slice(0, 10));
    }

    const byDate = new Map<
      string,
      {
        status: string;
        is_late: boolean;
        late_minutes: number | null;
        check_in_time: Date | null;
        check_out_time: Date | null;
      }
    >();

    for (const a of attendances) {
      if (!a.attendance_date) continue;
      const key = a.attendance_date.toISOString().slice(0, 10);
      byDate.set(key, {
        status: a.status,
        is_late: a.is_late,
        late_minutes: a.late_minutes,
        check_in_time: a.check_in_time,
        check_out_time: a.check_out_time,
      });
    }

    const summary: Record<AttendanceStatus, number> = {
      PRESENT: 0,
      ABSENT: 0,
      LEAVE: 0,
      SICK: 0,
      '-': 0,
    };

    const attendance_histories = days.map((tanggal) => {
      const record = byDate.get(tanggal);
      const status = (record?.status ?? '-') as AttendanceStatus;

      summary[status] = (summary[status] ?? 0) + 1;

      return {
        tanggal,
        status,
        is_late: record?.is_late ?? false,
        late_minutes: record?.late_minutes ?? 0,
        check_in_time: record?.check_in_time
          ? record.check_in_time.toISOString()
          : null,
        check_out_time: record?.check_out_time
          ? record.check_out_time.toISOString()
          : null,
      };
    });

    return {
      range: {
        month,
        year,
        start_date: start.toISOString().slice(0, 10),
        end_date: new Date(endExclusive.getTime() - 1)
          .toISOString()
          .slice(0, 10),
      },
      employee: {
        employee_id: employee.employee_id,
        name: employee.name,
        email: employee.email,
        avatar_uri: employee.avatar_uri,
        attendance_histories,
        summary,
      },
    };
  }

  // ===================== PRIVATE HELPERS =====================

  private assertAttendanceWindowOpen(params: {
    nowMin: number;
    openTime: Date | null;
    closeTime: Date | null;
  }) {
    const { nowMin, openTime, closeTime } = params;

    if (openTime) {
      const openMin = timeToMinutesFromDb(openTime);
      if (nowMin < openMin) {
        throw new BadRequestException(
          'Attendance is not open yet at this time',
        );
      }
    }

    if (closeTime) {
      const closeMin = timeToMinutesFromDb(closeTime);
      if (nowMin > closeMin) {
        throw new BadRequestException('Attendance is already closed');
      }
    }
  }

  private async findEmployeeCompanyForCheckIn(
    tx: Prisma.TransactionClient,
    employeeId: string,
  ) {
    const employee = await tx.employee.findUnique({
      where: { employee_id: employeeId },
      select: {
        company: {
          select: {
            company_id: true,
            attendance_location_enabled: true,
            attendance_radius_meters: true,
            work_start_time: true,
            attendance_open_time: true,
            attendance_tolerance_minutes: true,
            attendance_close_time: true,
          },
        },
      },
    });

    if (!employee?.company) throw new BadRequestException('Employee not found');
    return { company: employee.company };
  }

  private async findEmployeeCompanyForCheckOut(
    tx: Prisma.TransactionClient,
    employeeId: string,
  ) {
    const employee = await tx.employee.findUnique({
      where: { employee_id: employeeId },
      select: {
        company: {
          select: {
            company_id: true,
            attendance_location_enabled: true,
            attendance_radius_meters: true,
            minimum_hours_per_day: true,
            work_start_time: true,
          },
        },
      },
    });

    if (!employee?.company) throw new BadRequestException('Employee not found');
    return { company: employee.company };
  }

  private async assertInRadiusIfEnabled(
    tx: Prisma.TransactionClient,
    params: {
      companyId: string;
      enabled: boolean;
      radiusMeters: number | null;
      latitude: number;
      longitude: number;
    },
  ) {
    const { companyId, enabled, radiusMeters, latitude, longitude } = params;

    if (!enabled) return;

    if (!radiusMeters) {
      throw new BadRequestException('Attendance radius not configured');
    }

    const rows = await tx.$queryRaw<GeoCheckRow[]>`
      SELECT
        (c.attendance_location IS NOT NULL) AS has_location,
        ST_DWithin(
          c.attendance_location,
          ST_SetSRID(
            ST_MakePoint(
              ${longitude}::double precision,
              ${latitude}::double precision
            ),
            4326
          )::geography,
          ${radiusMeters}::double precision
        ) AS in_radius
      FROM companies c
      WHERE c.company_id = ${companyId}
      LIMIT 1
    `;

    const hasLocation = rows?.[0]?.has_location ?? false;
    if (!hasLocation)
      throw new BadRequestException('Attendance location not configured');

    const inRadius = rows?.[0]?.in_radius ?? false;
    if (!inRadius)
      throw new BadRequestException('You are outside the attendance radius');
  }

  private async updateAttendanceLocation(
    tx: Prisma.TransactionClient,
    params: {
      employeeAttendanceId: string;
      type: 'check_in' | 'check_out';
      latitude: number;
      longitude: number;
    },
  ) {
    const { employeeAttendanceId, type, latitude, longitude } = params;

    const column =
      type === 'check_in' ? 'check_in_location' : 'check_out_location';

    await tx.$executeRawUnsafe(
      `
      UPDATE employee_attendances
      SET ${column} =
        ST_SetSRID(
          ST_MakePoint($1::double precision, $2::double precision),
          4326
        )::geography
      WHERE employee_attendance_id = $3
    `,
      longitude,
      latitude,
      employeeAttendanceId,
    );
  }

  private async updateCompanyTimeColumns(
    tx: Prisma.TransactionClient,
    companyId: string,
    dto: Partial<UpdateAttendanceSettingDto>,
  ) {
    if (dto.attendance_open_time !== undefined) {
      await tx.$executeRaw`
        UPDATE companies
        SET attendance_open_time = ${dto.attendance_open_time}::time
        WHERE company_id = ${companyId}
      `;
    }

    if (dto.attendance_close_time !== undefined) {
      await tx.$executeRaw`
        UPDATE companies
        SET attendance_close_time = ${dto.attendance_close_time}::time
        WHERE company_id = ${companyId}
      `;
    }

    if (dto.work_start_time !== undefined) {
      await tx.$executeRaw`
        UPDATE companies
        SET work_start_time = ${dto.work_start_time}::time
        WHERE company_id = ${companyId}
      `;
    }
  }

  private async getCompanyAttendanceLocation(
    companyId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;

    const rows = await client.$queryRaw<
      { latitude: number | null; longitude: number | null }[]
    >`
      SELECT
        ST_Y(attendance_location::geometry) AS latitude,
        ST_X(attendance_location::geometry) AS longitude
      FROM companies
      WHERE company_id = ${companyId}
      LIMIT 1
    `;

    return rows?.[0]
      ? { latitude: rows[0].latitude, longitude: rows[0].longitude }
      : { latitude: null, longitude: null };
  }

  private calculateLateMinutes(
    checkIn: Date,
    workStart: Date | null,
    toleranceMinutes = 0,
  ): { lateMinutes: number; isLate: boolean } {
    if (!workStart) return { lateMinutes: 0, isLate: false };

    const workStartToday = new Date(checkIn);
    workStartToday.setHours(workStart.getHours(), workStart.getMinutes(), 0, 0);

    const diffMs = checkIn.getTime() - workStartToday.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const lateMinutes = Math.max(0, diffMinutes - toleranceMinutes);

    return { lateMinutes, isLate: lateMinutes > 0 };
  }

  private getWorkStartToday(
    now: Date,
    companyWorkStart: Date | null,
  ): Date | null {
    if (!companyWorkStart) return null;

    const workStartToday = new Date(now);
    workStartToday.setHours(
      companyWorkStart.getHours(),
      companyWorkStart.getMinutes(),
      0,
      0,
    );

    return workStartToday;
  }

  private calcEffectiveWorkedHours(params: {
    now: Date;
    checkIn: Date | null;
    isLate: boolean;
    companyWorkStart: Date | null;
  }): number {
    const { now, checkIn, isLate, companyWorkStart } = params;

    if (isLate) {
      if (!checkIn) return 0;
      return (now.getTime() - checkIn.getTime()) / 3600000;
    }

    const workStartToday = this.getWorkStartToday(now, companyWorkStart);
    if (!workStartToday) {
      if (!checkIn) return 0;
      return (now.getTime() - checkIn.getTime()) / 3600000;
    }

    return (now.getTime() - workStartToday.getTime()) / 3600000;
  }
}
