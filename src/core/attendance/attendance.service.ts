import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { FaceRecognitionService } from '../face-recognition/face-recognition.service';
import { startOfDay } from 'src/utils/date.utils';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { EmployeeService } from '../employee/employee.service';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly faceRecognitionService: FaceRecognitionService,
    private readonly employeeService: EmployeeService,
  ) {}

  async checkInFace(
    file: Express.Multer.File,
    employeeId: string,
    data: CheckInDto,
  ) {
    const today = startOfDay();
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
        const attendanceOpenTime = new Date(nowTime);
        attendanceOpenTime.setHours(
          company.attendance_open_time.getHours(),
          company.attendance_open_time.getMinutes(),
          0,
          0,
        );
        if (nowTime < attendanceOpenTime) {
          throw new BadRequestException(
            'Attendance is not open yet at this time',
          );
        }
      }

      if (company.attendance_close_time) {
        const attendanceCloseTime = new Date(nowTime);
        attendanceCloseTime.setHours(
          company.attendance_close_time.getHours(),
          company.attendance_close_time.getMinutes(),
          0,
          0,
        );
        if (nowTime > attendanceCloseTime) {
          throw new BadRequestException('Attendance is already closed');
        }
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
      });

      if (!existing)
        throw new BadRequestException('You have not checked in today');

      const total_work_hours = this.calcEffectiveWorkedHours({
        now: nowTime,
        checkIn: existing.check_in_time,
        isLate: existing.is_late,
        companyWorkStart: company.work_start_time,
      });

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
}
