import { Injectable } from '@nestjs/common';
import { CreateLeaveApplicationDto } from './dto/create-leave-application.dto';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { EmployeeService } from '../employee/employee.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { UpdateStatusLeaveApplicationDto } from './dto/update-status-leave-application.dto';
import { AttendanceStatus } from 'generated/prisma';
@Injectable()
export class LeaveApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeService: EmployeeService,
  ) {}

  async getEmployeeLeaveApplications(employee_id: string) {
    const leaveApplications =
      await this.prisma.employeeLeaveApplication.findMany({
        where: {
          employee_id,
          deleted_at: null,
        },
        orderBy: {
          created_at: 'desc',
        },
      });
    return leaveApplications;
  }

  async create(employee_id: string, dto: CreateLeaveApplicationDto) {
    return this.prisma.$transaction(async (tx) => {
      const employee = await this.employeeService.getEmployeeById(employee_id);
      if (!employee) throw new BadRequestException('Employee not found');

      // Parse "YYYY-MM-DD" jadi DATE murni (00:00) biar stabil
      const startDate = new Date(`${dto.start_date}T00:00:00.000Z`);
      const endDate = new Date(`${dto.end_date}T00:00:00.000Z`);

      // Double safety
      if (endDate < startDate) {
        throw new BadRequestException('end_date must be >= start_date');
      }

      // (Opsional tapi penting) Cegah overlap dengan leave lain (pending/approved)
      const overlap = await tx.employeeLeaveApplication.findFirst({
        where: {
          employee_id,
          deleted_at: null,
          status: { in: [0, 1] }, // pending & approved
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

      const created = await tx.employeeLeaveApplication.create({
        data: {
          employee_id,
          start_date: startDate,
          end_date: endDate,
          reason: dto.reason.trim(),
          attachment_uri: dto.attachment_uri,
          type: dto.type as 'LEAVE' | 'SICK',
        },
      });

      return created;
    });
  }

  async getCompanyLeaveApplications(company_id: string) {
    const leaveApplications =
      await this.prisma.employeeLeaveApplication.findMany({
        where: {
          employee: {
            company_id,
          },
          deleted_at: null,
        },
        orderBy: {
          created_at: 'desc',
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
        },
      });
    return leaveApplications;
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

      if (leave.status !== 0) {
        throw new BadRequestException('Leave application already processed');
      }

      const newStatus = dto.is_approve ? 1 : 2;

      const updated = await tx.employeeLeaveApplication.update({
        where: {
          employee_leave_application_id: leave.employee_leave_application_id,
        },
        data: { status: newStatus },
      });

      // kalau approved → buat attendance LEAVE untuk setiap tanggal
      if (newStatus === 1) {
        // normalize ke tanggal murni (00:00 UTC) biar tidak geser hari
        const start = new Date(
          Date.UTC(
            leave.start_date.getUTCFullYear(),
            leave.start_date.getUTCMonth(),
            leave.start_date.getUTCDate(),
          ),
        );
        const end = new Date(
          Date.UTC(
            leave.end_date.getUTCFullYear(),
            leave.end_date.getUTCMonth(),
            leave.end_date.getUTCDate(),
          ),
        );

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
            employee_id: leave.employee_id,
            attendance_date: new Date(cursor),
            status: leave.type,
          });
        }

        await tx.employeeAttendance.createMany({
          data: rows,
          skipDuplicates: true,
        });
      }

      return updated;
    });
  }
}
