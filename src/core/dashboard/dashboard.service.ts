import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { startOfDay } from 'src/utils/date.utils';

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
        },
        attendance_date: today,
        status: 'PRESENT',
      },
    });

    const employeeAbsentToday = await this.prisma.employeeAttendance.count({
      where: {
        employee: {
          company_id: companyId,
        },
        attendance_date: today,
        status: 'ABSENT',
      },
    });

    const employeeLateToday = await this.prisma.employeeAttendance.count({
      where: {
        employee: {
          company_id: companyId,
        },
        attendance_date: today,
        status: 'PRESENT',
        is_late: true,
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

    return {
      total_employee: employeeCount,
      employeePresentToday: employeePresentToday,
      employeeAbsentToday: employeeAbsentToday,
      employeeLateToday: employeeLateToday,
      employeeHasNotCheckedOut: employeeHasNotCheckedOut,
    };
  }
}
