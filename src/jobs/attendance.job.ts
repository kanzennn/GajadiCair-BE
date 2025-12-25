import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AttendanceStatus } from 'generated/prisma';
import { PrismaService } from 'src/common/services/prisma/prisma.service';

@Injectable()
export class AttendanceJobService {
  private readonly logger = new Logger(AttendanceJobService.name);

  constructor(private readonly prisma: PrismaService) {}

  // @Cron('5 0 * * *', { timeZone: 'Asia/Jakarta' })
  @Cron('*/10 * * * * *')
  async handleAutoAbsent() {
    this.logger.log('Running auto-absent job (Jakarta timezone)');

    /**
     * 1️⃣ Tentukan tanggal kemarin (UTC date-only)
     * Cron dijalankan jam 00:05 WIB → kemarin sudah fix
     */
    const nowJakarta = new Date();
    const targetDate = new Date(
      Date.UTC(
        nowJakarta.getUTCFullYear(),
        nowJakarta.getUTCMonth(),
        nowJakarta.getUTCDate() - 1,
      ),
    );

    const dateStr = targetDate.toISOString().slice(0, 10);
    this.logger.log(`Processing absent for date ${dateStr}`);

    /**
     * 2️⃣ Ambil semua employee aktif + company + working_days
     */
    const employees = await this.prisma.employee.findMany({
      where: {
        deleted_at: null,
        is_active: true,
        created_at: { lt: targetDate },
      },
      select: {
        employee_id: true,
        company_id: true,
        company: {
          select: {
            working_days: {
              where: { deleted_at: null },
            },
            custom_holidays: {
              where: {
                deleted_at: null,
                start_date: { lte: targetDate },
                end_date: { gte: targetDate },
              },
            },
          },
        },
      },
    });

    if (employees.length === 0) {
      this.logger.log('No active employees found');
      return;
    }

    /**
     * 3️⃣ Helper: cek hari kerja
     */
    const dayOfWeek = targetDate.getUTCDay(); // 0=Sun ... 6=Sat
    const dayMap = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ] as const;

    /**
     * 4️⃣ Ambil attendance yang SUDAH ADA (apa pun statusnya)
     */
    const existingAttendances = await this.prisma.employeeAttendance.findMany({
      where: {
        attendance_date: targetDate,
        deleted_at: null,
      },
      select: {
        employee_id: true,
      },
    });

    const existingSet = new Set(existingAttendances.map((a) => a.employee_id));

    /**
     * 5️⃣ Tentukan siapa yang harus ABSENT
     */
    const toCreate: {
      employee_id: string;
      attendance_date: Date;
      status: AttendanceStatus;
      absent_reason: string;
    }[] = [];

    for (const emp of employees) {
      // skip kalau sudah ada attendance
      if (existingSet.has(emp.employee_id)) continue;

      const workingDay = emp.company.working_days[0];
      if (!workingDay) continue;

      // ❌ bukan hari kerja
      if (!workingDay[dayMap[dayOfWeek]]) continue;

      // ❌ hari libur custom
      if (emp.company.custom_holidays.length > 0) continue;

      toCreate.push({
        employee_id: emp.employee_id,
        attendance_date: targetDate,
        status: AttendanceStatus.ABSENT,
        absent_reason: 'AUTO_ABSENT_NO_RECORD',
      });
    }

    /**
     * 6️⃣ Insert ABSENT (idempotent)
     */
    if (toCreate.length > 0) {
      await this.prisma.employeeAttendance.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    }

    this.logger.log(
      `Auto-absent completed for ${dateStr}, created ${toCreate.length} ABSENT records`,
    );
  }
}
