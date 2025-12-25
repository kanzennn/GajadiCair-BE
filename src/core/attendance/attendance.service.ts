import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { FaceRecognitionService } from '../face-recognition/face-recognition.service';
import {
  addDaysUtc,
  dateOnlyUtc,
  nowMinutesJakarta,
  parseIsoDateOrTodayUtc,
  startOfDay,
  timeToMinutesFromDb,
  toYmd,
} from 'src/utils/date.utils';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { EmployeeService } from '../employee/employee.service';
import { UpdateAttendanceSettingDto } from './dto/update-attendance-setting.dto';
import { AttendanceSummaryQueryDto } from './dto/attendance-summary-query.dto';
import { AttendanceByCompanyQueryDto } from './dto/attendance-by-company-query.dto';
import { CompanyService } from '../company/company.service';
import { UpdateAttendanceByCompanyDto } from './dto/update-attendance-by-company';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly faceRecognitionService: FaceRecognitionService,
    private readonly employeeService: EmployeeService,
    private readonly companyService: CompanyService,
  ) {}

  async checkInFace(
    file: Express.Multer.File,
    employeeId: string,
    data: CheckInDto,
  ) {
    const today = startOfDay();
    const nowTime = new Date();
    const nowMin = nowMinutesJakarta(nowTime);

    await this.faceRecognitionService.verifyFace(file, employeeId);

    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUnique({
        where: { employee_id: employeeId },
        select: {
          company_id: true,
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

      if (!employee?.company)
        throw new BadRequestException('Employee not found');

      const company = employee.company;

      if (company.attendance_open_time) {
        const openMin = timeToMinutesFromDb(company.attendance_open_time);
        if (nowMin < openMin)
          throw new BadRequestException(
            'Attendance is not open yet at this time',
          );
      }

      if (company.attendance_close_time) {
        const closeMin = timeToMinutesFromDb(company.attendance_close_time);
        if (nowMin > closeMin)
          throw new BadRequestException('Attendance is already closed');
      }

      if (company.attendance_location_enabled) {
        if (!company.attendance_radius_meters) {
          throw new BadRequestException('Attendance radius not configured');
        }

        // cek: lokasi company ada? + user dalam radius?
        const rows = await tx.$queryRaw<
          { has_location: boolean; in_radius: boolean }[]
        >`
        SELECT
          (c.attendance_location IS NOT NULL) AS has_location,
          ST_DWithin(
            c.attendance_location,
            ST_SetSRID(
              ST_MakePoint(
                ${data.longitude}::double precision,
                ${data.latitude}::double precision
              ),
              4326
            )::geography,
            ${company.attendance_radius_meters}::double precision
          ) AS in_radius
        FROM companies c
        WHERE c.company_id = ${company.company_id}
        LIMIT 1
      `;

        const hasLocation = rows?.[0]?.has_location ?? false;
        if (!hasLocation) {
          throw new BadRequestException('Attendance location not configured');
        }

        const inRadius = rows?.[0]?.in_radius ?? false;
        if (!inRadius) {
          throw new BadRequestException(
            'You are outside the attendance radius',
          );
        }
      }

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
        nowTime,
        company.work_start_time,
        company.attendance_tolerance_minutes ?? 0,
      );

      const created = await tx.employeeAttendance.create({
        data: {
          employee_id: employeeId,
          attendance_date: today,
          check_in_time: nowTime,
          late_minutes: lateMinutes,
          is_late: isLate,
        },
        select: { employee_attendance_id: true },
      });

      // simpan check_in_location (kalau enabled, atau kalau kamu mau selalu simpan)
      await tx.$executeRaw`
      UPDATE employee_attendances
      SET check_in_location =
        ST_SetSRID(
          ST_MakePoint(
            ${data.longitude}::double precision,
            ${data.latitude}::double precision
          ),
          4326
        )::geography
      WHERE employee_attendance_id = ${created.employee_attendance_id}
    `;

      await tx.attendanceLog.create({
        data: {
          employee_id: employeeId,
          log_type: 0,
        },
      });

      return tx.employeeAttendance.findUnique({
        where: { employee_attendance_id: created.employee_attendance_id },
      });
    });
  }

  async checkOutFace(
    file: Express.Multer.File,
    employeeId: string,
    data: CheckOutDto,
  ) {
    const nowTime = new Date();

    await this.faceRecognitionService.verifyFace(file, employeeId);

    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUnique({
        where: { employee_id: employeeId },
        select: {
          company_id: true,
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

      if (!employee?.company)
        throw new BadRequestException('Employee not found');

      const company = employee.company;

      if (company.attendance_location_enabled) {
        if (!company.attendance_radius_meters) {
          throw new BadRequestException('Attendance radius not configured');
        }

        // cek: lokasi company ada? + user dalam radius?
        const rows = await tx.$queryRaw<
          { has_location: boolean; in_radius: boolean }[]
        >`
        SELECT
          (c.attendance_location IS NOT NULL) AS has_location,
          ST_DWithin(
            c.attendance_location,
            ST_SetSRID(
              ST_MakePoint(
                ${data.longitude}::double precision,
                ${data.latitude}::double precision
              ),
              4326
            )::geography,
            ${company.attendance_radius_meters}::double precision
          ) AS in_radius
        FROM companies c
        WHERE c.company_id = ${company.company_id}
        LIMIT 1
      `;

        const hasLocation = rows?.[0]?.has_location ?? false;
        if (!hasLocation) {
          throw new BadRequestException('Attendance location not configured');
        }

        const inRadius = rows?.[0]?.in_radius ?? false;
        if (!inRadius) {
          throw new BadRequestException(
            'You are outside the attendance radius',
          );
        }
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existing = await tx.employeeAttendance.findFirst({
        where: {
          employee_id: employeeId,
          check_out_time: null,
          deleted_at: null,
        },
        orderBy: {
          attendance_date: 'desc',
        },
      });

      if (!existing)
        throw new BadRequestException('You have not checked in today');

      let total_work_hours = this.calcEffectiveWorkedHours({
        now: nowTime,
        checkIn: existing.check_in_time,
        isLate: existing.is_late,
        companyWorkStart: company.work_start_time,
      });

      if (total_work_hours < 0) {
        total_work_hours = 0;
      }

      const minHours = company.minimum_hours_per_day ?? 0;

      if (minHours > 0 && total_work_hours < minHours) {
        throw new BadRequestException(
          `You must work at least ${minHours} hours. You have worked ${total_work_hours.toFixed(2)} hours.`,
        );
      }

      const updated = await tx.employeeAttendance.update({
        where: {
          employee_attendance_id: existing.employee_attendance_id,
          status: 'PRESENT',
        },
        data: {
          check_out_time: nowTime,
          total_work_hours,
        },
        select: { employee_attendance_id: true },
      });

      // simpan check_in_location (kalau enabled, atau kalau kamu mau selalu simpan)
      await tx.$executeRaw`
      UPDATE employee_attendances
      SET check_out_location =
        ST_SetSRID(
          ST_MakePoint(
            ${data.longitude}::double precision,
            ${data.latitude}::double precision
          ),
          4326
        )::geography
      WHERE employee_attendance_id = ${updated.employee_attendance_id}
    `;

      await tx.attendanceLog.create({
        data: {
          employee_id: employeeId,
          log_type: 1,
        },
      });

      return tx.employeeAttendance.findUnique({
        where: { employee_attendance_id: updated.employee_attendance_id },
      });
    });
  }

  async getAllAttendance(employeeId: string) {
    const attendance = await this.prisma.employeeAttendance.findMany({
      where: {
        employee_id: employeeId,
        deleted_at: null,
      },
      orderBy: { attendance_date: 'desc' },
    });

    return attendance;
  }

  async getTodayAttendanceStatus(employeeId: string) {
    const today = startOfDay();

    const attendance = await this.prisma.employeeAttendance.findFirst({
      where: {
        employee_id: employeeId,
        attendance_date: today,
        deleted_at: null,
      },
    });

    return attendance;
  }

  async canEmployeeCheckOut(employeeId: string) {
    const isEmployee =
      await this.employeeService.getEmployeeByIdWithCompany(employeeId);

    if (!isEmployee) {
      throw new BadRequestException('Employee not found');
    }

    const company = isEmployee.company;

    const nowTime = new Date();

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

    const total_work_hours = this.calcEffectiveWorkedHours({
      now: nowTime,
      checkIn: attendance.check_in_time,
      isLate: attendance.is_late,
      companyWorkStart: company.work_start_time,
    });

    if (minHours > 0 && total_work_hours < minHours) {
      return {
        can_check_out: false,
        min_hours: minHours,
        worked_hours: total_work_hours,
        reason: `Minimum work hours not met. Required: ${minHours} hours, Worked: ${total_work_hours.toFixed(2)} hours.`,
      };
    }

    return {
      can_check_out: true,
      in_hours: minHours,
      worked_hours: total_work_hours,
      reason: null,
    };
  }

  async canEmployeeCheckIn(employeeId: string) {
    const isEmployee =
      await this.employeeService.getEmployeeByIdWithCompany(employeeId);

    if (!isEmployee) {
      throw new BadRequestException('Employee not found');
    }

    const company = isEmployee.company;

    const nowTime = new Date();

    const nowMin = nowMinutesJakarta(nowTime);

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

  private calculateLateMinutes(
    checkIn: Date,
    workStart: Date | null,
    toleranceMinutes = 0,
  ): { lateMinutes: number; isLate: boolean } {
    if (!workStart) {
      return { lateMinutes: 0, isLate: false };
    }

    // Tempel jam kerja ke tanggal check-in (WIB-safe)
    const workStartToday = new Date(checkIn);
    workStartToday.setHours(workStart.getHours(), workStart.getMinutes(), 0, 0);

    const diffMs = checkIn.getTime() - workStartToday.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    const lateMinutes = Math.max(0, diffMinutes - toleranceMinutes);

    return {
      lateMinutes,
      isLate: lateMinutes > 0,
    };
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

    // kalau telat → start dari check-in
    if (isLate) {
      if (!checkIn) return 0;
      return (now.getTime() - checkIn.getTime()) / 3600000;
    }

    // kalau tidak telat → start dari work_start_time company (hari ini)
    const workStartToday = this.getWorkStartToday(now, companyWorkStart);
    if (!workStartToday) {
      // fallback kalau company belum set work_start_time
      if (!checkIn) return 0;
      return (now.getTime() - checkIn.getTime()) / 3600000;
    }

    return (now.getTime() - workStartToday.getTime()) / 3600000;
  }

  async getAttendanceSetting(companyId: string) {
    const setting = await this.prisma.company.findUnique({
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

    const rows = await this.prisma.$queryRaw<
      { latitude: number | null; longitude: number | null }[]
    >`
    SELECT
      ST_Y(attendance_location::geometry) AS latitude,
      ST_X(attendance_location::geometry) AS longitude
    FROM companies
    WHERE company_id = ${companyId}
    LIMIT 1
  `;

    const location = rows[0]
      ? { latitude: rows[0].latitude, longitude: rows[0].longitude }
      : { latitude: null, longitude: null };

    return {
      ...setting,
      attendance_location: location, // { latitude, longitude }
    };
  }

  async updateAttendanceSetting(
    companyId: string,
    dto: Partial<UpdateAttendanceSettingDto>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1) Update fields yang support prisma
      await tx.company.update({
        where: { company_id: companyId },
        data: {
          minimum_hours_per_day: dto.minimum_hours_per_day,
          attendance_tolerance_minutes: dto.attendance_tolerance_minutes,
          payroll_day_of_month: dto.payroll_day_of_month,
          attendance_location_enabled: dto.attendance_location_enabled,
          attendance_radius_meters: dto.attendance_radius_meters,
        },
      });

      // 2) Update TIME columns via raw
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

      // 3) ✅ Update LOCATION (geography) via raw
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

      // kalau explicit dimatikan → null-kan location
      if (dto.attendance_location_enabled === false) {
        await tx.$executeRaw`
        UPDATE companies
        SET attendance_location = NULL
        WHERE company_id = ${companyId}
      `;
      }

      // 4) Read location + updated data (pakai tx, bukan this.prisma)
      const rows = await tx.$queryRaw<
        { latitude: number | null; longitude: number | null }[]
      >`
      SELECT
        ST_Y(attendance_location::geometry) AS latitude,
        ST_X(attendance_location::geometry) AS longitude
      FROM companies
      WHERE company_id = ${companyId}
      LIMIT 1
    `;

      const location = rows[0]
        ? { latitude: rows[0].latitude, longitude: rows[0].longitude }
        : { latitude: null, longitude: null };

      const updatedData = await tx.company.findUnique({
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
        ...updatedData,
        attendance_location: location,
      };
    });
  }

  async getAttendanceSummaryByCompany(
    companyId: string,
    query?: AttendanceSummaryQueryDto,
  ) {
    // Default: 7 hari terakhir (hari ini inklusif)
    const isCompanyExist = await this.companyService.getCompanyById(companyId);
    if (!isCompanyExist) {
      throw new BadRequestException('Company not found');
    }

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

    // list tanggal
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

        // init counter
        const summary: Record<string, number> = {
          PRESENT: 0,
          ABSENT: 0,
          LEAVE: 0,
          SICK: 0,
          '-': 0,
        };

        const attendance_histories = days.map((tanggal) => {
          const record = byDate.get(tanggal);

          const status = record?.status ?? '-';

          // hitung status
          if (summary[status] !== undefined) {
            summary[status]++;
          } else {
            summary[status] = 1;
          }

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

    // Ambil semua employee, dan attendance yg match tanggal itu
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
          where: {
            deleted_at: null,
            attendance_date: day, // karena @db.Date → match exact date
          },
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

    // rapihin: attendances (array) → attendance (single | null)
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

    // ambil attendance + employee untuk validasi ownership
    const attendance = await this.prisma.employeeAttendance.findFirst({
      where: {
        employee_attendance_id: dto.employee_attendance_id,
        deleted_at: null,
        employee: {
          company_id: companyId,
        },
      },
      include: {
        employee: true,
      },
    });

    if (!attendance) {
      throw new BadRequestException('Attendance not found for this company');
    }

    // parse time
    const checkIn = dto.check_in_time ? new Date(dto.check_in_time) : null;

    const checkOut = dto.check_out_time ? new Date(dto.check_out_time) : null;

    // ❌ check_out < check_in
    if (checkIn && checkOut && checkOut < checkIn) {
      throw new BadRequestException(
        'check_out_time cannot be earlier than check_in_time',
      );
    }

    // ❌ status ABSENT / LEAVE / SICK tidak boleh punya waktu masuk/keluar
    if (
      ['ABSENT', 'LEAVE', 'SICK'].includes(dto.status) &&
      (checkIn || checkOut)
    ) {
      throw new BadRequestException(
        `${dto.status} attendance cannot have check-in or check-out time`,
      );
    }

    // auto set is_late
    const isLate =
      dto.late_minutes !== undefined
        ? dto.late_minutes > 0
        : (dto.is_late ?? false);

    return this.prisma.employeeAttendance.update({
      where: {
        employee_attendance_id: dto.employee_attendance_id,
      },
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
}
