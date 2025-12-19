import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AttendanceStatus } from 'generated/prisma';
import { PrismaService } from 'src/common/services/prisma/prisma.service';

@Injectable()
export class AttendanceJobService {
  private readonly logger = new Logger(AttendanceJobService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('*/10 * * * * *')
  async handleAbsent() {
    this.logger.log('Running auto-absent job (00:00 Jakarta)');

    // 1️⃣ Tentukan tanggal kemarin (00:00)
    const now = new Date();
    console.log(now.toISOString());
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() - 1);
    targetDate.setHours(0, 0, 0, 0);

    // 2️⃣ Ambil semua employee aktif
    const employees = await this.prisma.employee.findMany({
      where: {
        deleted_at: null,
        is_active: true,
      },
      select: {
        employee_id: true,
      },
    });

    if (employees.length === 0) {
      this.logger.log('No active employees found');
      return;
    }

    const employeeIds = employees.map((e) => e.employee_id);

    // 3️⃣ Ambil attendance yang SUDAH ADA untuk tanggal kemarin
    const existingAttendances = await this.prisma.employeeAttendance.findMany({
      where: {
        attendance_date: targetDate,
        employee_id: { in: employeeIds },
        deleted_at: null,
      },
      select: {
        employee_id: true,
        check_in_time: true,
      },
    });

    const existingSet = new Set(existingAttendances.map((a) => a.employee_id));

    // 4️⃣ Employee yang BELUM punya record → create ABSENT
    const toCreate = employeeIds
      .filter((id) => !existingSet.has(id))
      .map((id) => ({
        employee_id: id,
        attendance_date: targetDate,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        status: AttendanceStatus.ABSENT,
        absent_reason: 'AUTO_ABSENT_NO_RECORD',
      }));

    if (toCreate.length > 0) {
      await this.prisma.employeeAttendance.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    }

    this.logger.log(
      `Auto-absent completed for ${targetDate.toISOString().slice(0, 10)}, created ${toCreate.length} absent records.`,
    );
  }
}
