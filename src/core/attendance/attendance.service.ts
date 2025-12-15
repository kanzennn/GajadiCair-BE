/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { FaceRecognitionService } from '../face-recognition/face-recognition.service';
import { startOfDay } from 'src/utils/date.utils';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly faceRecognitionService: FaceRecognitionService,
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
            },
          },
        },
      });

      if (!employee?.company)
        throw new BadRequestException('Employee not found');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

      const existing = await tx.employeeAttendance.findFirst({
        where: {
          employee_id: employeeId,
          attendance_date: today,
          deleted_at: null,
        },
        select: { employee_attendance_id: true },
      });

      if (existing) throw new BadRequestException('Already checked in today');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const created = await tx.employeeAttendance.create({
        data: {
          employee_id: employeeId,
          attendance_date: today,
          check_in_time: nowTime,
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
            },
          },
        },
      });

      if (!employee?.company)
        throw new BadRequestException('Employee not found');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

      const existing = await tx.employeeAttendance.findFirst({
        where: {
          employee_id: employeeId,
          check_out_time: null,
          deleted_at: null,
        },
      });

      if (!existing)
        throw new BadRequestException('You have not checked in today');

      const total_work_hours =
        (nowTime.getTime() - existing.check_in_time.getTime()) / 3600000;

      const updated = await tx.employeeAttendance.update({
        where: { employee_attendance_id: existing.employee_attendance_id },
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
}
