import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

import { EmployeeService } from '../employee/employee.service';

import { CreateLeaveApplicationDto } from './dto/create-leave-application.dto';
import { UpdateStatusLeaveApplicationDto } from './dto/update-status-leave-application.dto';

import { AttendanceStatus, Prisma } from 'generated/prisma';

type LeaveStatus = 0 | 1 | 2; // 0=pending, 1=approved, 2=rejected
type LeaveType = 'LEAVE' | 'SICK';

@Injectable()
export class LeaveApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeService: EmployeeService,
  ) {}

  // ===================== Employee =====================

  async getEmployeeLeaveApplications(employee_id: string) {
    return this.prisma.employeeLeaveApplication.findMany({
      where: { employee_id, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
  }

  async create(employee_id: string, dto: CreateLeaveApplicationDto) {
    return this.prisma.$transaction(async (tx) => {
      const employee = await this.employeeService.getEmployeeById(employee_id);
      if (!employee) throw new BadRequestException('Employee not found');

      const { startDate, endDate } = this.parseDateRangeOrThrow(
        dto.start_date,
        dto.end_date,
      );

      const overlap = await tx.employeeLeaveApplication.findFirst({
        where: {
          employee_id,
          deleted_at: null,
          status: { in: [0, 1] as LeaveStatus[] }, // pending & approved
          AND: [
            { start_date: { lte: endDate } },
            { end_date: { gte: startDate } },
          ],
        },
        select: { employee_leave_application_id: true },
      });

      if (overlap) {
        throw new BadRequestException(
          'Leave application overlaps with existing leave',
        );
      }

      return tx.employeeLeaveApplication.create({
        data: {
          employee_id,
          start_date: startDate,
          end_date: endDate,
          reason: dto.reason.trim(),
          attachment_uri: dto.attachment_uri,
          type: dto.type as LeaveType,
        },
      });
    });
  }

  // ===================== Company =====================

  async getCompanyLeaveApplications(company_id: string) {
    return this.prisma.employeeLeaveApplication.findMany({
      where: { employee: { company_id }, deleted_at: null },
      orderBy: { created_at: 'desc' },
      include: {
        employee: {
          select: {
            employee_id: true,
            name: true,
            email: true,
            avatar_uri: true,
          },
        },
      },
    });
  }

  async updateLeaveApplicationStatus(
    company_id: string,
    dto: UpdateStatusLeaveApplicationDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const leave = await tx.employeeLeaveApplication.findFirst({
        where: {
          employee_leave_application_id: dto.employee_leave_application_id,
          deleted_at: null,
          employee: { company_id },
        },
        select: {
          employee_leave_application_id: true,
          employee_id: true,
          start_date: true,
          end_date: true,
          status: true,
          type: true,
        },
      });

      if (!leave) throw new BadRequestException('Leave application not found');
      if (leave.status !== 0)
        throw new BadRequestException('Leave application already processed');

      const newStatus: LeaveStatus = dto.is_approve ? 1 : 2;

      const updated = await tx.employeeLeaveApplication.update({
        where: {
          employee_leave_application_id: leave.employee_leave_application_id,
        },
        data: { status: newStatus },
      });

      if (newStatus === 1) {
        await this.createAttendanceForApprovedLeave(tx, {
          employee_id: leave.employee_id,
          start_date: leave.start_date,
          end_date: leave.end_date,
          status: leave.type as AttendanceStatus,
        });
      }

      return updated;
    });
  }

  // ===================== Private Helpers =====================

  private parseDateRangeOrThrow(startYmd: string, endYmd: string) {
    // Parse "YYYY-MM-DD" -> DATE murni 00:00 UTC biar stabil
    const startDate = new Date(`${startYmd}T00:00:00.000Z`);
    const endDate = new Date(`${endYmd}T00:00:00.000Z`);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid start_date or end_date');
    }

    if (endDate < startDate) {
      throw new BadRequestException('end_date must be >= start_date');
    }

    return { startDate, endDate };
  }

  private normalizeUtcDateOnly(d: Date) {
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
  }

  private async createAttendanceForApprovedLeave(
    tx: Prisma.TransactionClient,
    params: {
      employee_id: string;
      start_date: Date;
      end_date: Date;
      status: AttendanceStatus;
    },
  ) {
    const start = this.normalizeUtcDateOnly(params.start_date);
    const end = this.normalizeUtcDateOnly(params.end_date);

    const rows: {
      employee_id: string;
      attendance_date: Date;
      status: AttendanceStatus;
    }[] = [];

    for (
      let cursor = new Date(start);
      cursor <= end;
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
      rows.push({
        employee_id: params.employee_id,
        attendance_date: new Date(cursor),
        status: params.status,
      });
    }

    // NOTE: tx di sini sebenarnya TransactionClient; tapi PrismaService juga punya createMany
    // biar typing rapih, bisa ganti signature jadi Prisma.TransactionClient.
    await tx.employeeAttendance.createMany({
      data: rows,
      skipDuplicates: true,
    });
  }
}
