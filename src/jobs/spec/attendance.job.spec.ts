// attendance.job.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';

import { AttendanceJobService } from '../attendance.job';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { AttendanceStatus } from 'generated/prisma';

describe('AttendanceJobService', () => {
  let service: AttendanceJobService;

  const prisma = {
    employee: {
      findMany: jest.fn(),
    },
    employeeAttendance: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceJobService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AttendanceJobService);

    // Optional: matiin logger biar test output bersih
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const freezeNow = (iso: string) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(iso));
  };

  const dateOnlyUTC = (isoDate: string) => new Date(`${isoDate}T00:00:00.000Z`);

  describe('handleAutoAbsent', () => {
    it('should return early when no active employees', async () => {
      // now: 2025-12-29 -> targetDate = 2025-12-28 (UTC date-only)
      freezeNow('2025-12-29T10:00:00.000Z');

      prisma.employee.findMany.mockResolvedValue([]);
      prisma.employeeAttendance.findMany.mockResolvedValue([]);

      await service.handleAutoAbsent();

      expect(prisma.employee.findMany).toHaveBeenCalled();
      expect(prisma.employeeAttendance.findMany).not.toHaveBeenCalled();
      expect(prisma.employeeAttendance.createMany).not.toHaveBeenCalled();
    });

    it('should create ABSENT for employees without attendance on working day and not holiday', async () => {
      freezeNow('2025-12-29T10:00:00.000Z');
      const targetDate = dateOnlyUTC('2025-12-28'); // kemarin

      prisma.employee.findMany.mockResolvedValue([
        // employee A: eligible -> absent dibuat
        {
          employee_id: 'e1',
          company_id: 'c1',
          company: {
            working_days: [
              {
                // 2025-12-28 itu Sunday (0) => sunday:true biar dianggap hari kerja
                sunday: true,
                monday: false,
                tuesday: false,
                wednesday: false,
                thursday: false,
                friday: false,
                saturday: false,
              },
            ],
            custom_holidays: [],
          },
        },
      ]);

      // belum ada attendance existing
      prisma.employeeAttendance.findMany.mockResolvedValue([]);
      prisma.employeeAttendance.createMany.mockResolvedValue({ count: 1 });

      await service.handleAutoAbsent();

      expect(prisma.employeeAttendance.findMany).toHaveBeenCalledWith({
        where: { attendance_date: targetDate, deleted_at: null },
        select: { employee_id: true },
      });

      expect(prisma.employeeAttendance.createMany).toHaveBeenCalledWith({
        data: [
          {
            employee_id: 'e1',
            attendance_date: targetDate,
            status: AttendanceStatus.ABSENT,
            absent_reason: 'AUTO_ABSENT_NO_RECORD',
          },
        ],
        skipDuplicates: true,
      });
    });

    it('should skip employees who already have attendance record', async () => {
      freezeNow('2025-12-29T10:00:00.000Z');

      prisma.employee.findMany.mockResolvedValue([
        {
          employee_id: 'e1',
          company_id: 'c1',
          company: {
            working_days: [
              {
                sunday: true,
                monday: true,
                tuesday: true,
                wednesday: true,
                thursday: true,
                friday: true,
                saturday: true,
              },
            ],
            custom_holidays: [],
          },
        },
      ]);

      prisma.employeeAttendance.findMany.mockResolvedValue([
        { employee_id: 'e1' }, // sudah ada
      ]);

      await service.handleAutoAbsent();

      expect(prisma.employeeAttendance.createMany).not.toHaveBeenCalled();
    });

    it('should skip when not working day', async () => {
      freezeNow('2025-12-29T10:00:00.000Z');

      prisma.employee.findMany.mockResolvedValue([
        {
          employee_id: 'e1',
          company_id: 'c1',
          company: {
            working_days: [
              {
                sunday: false, // bukan hari kerja
                monday: true,
                tuesday: true,
                wednesday: true,
                thursday: true,
                friday: true,
                saturday: false,
              },
            ],
            custom_holidays: [],
          },
        },
      ]);

      prisma.employeeAttendance.findMany.mockResolvedValue([]);

      await service.handleAutoAbsent();

      expect(prisma.employeeAttendance.createMany).not.toHaveBeenCalled();
    });

    it('should skip when custom holiday exists on target date', async () => {
      freezeNow('2025-12-29T10:00:00.000Z');

      prisma.employee.findMany.mockResolvedValue([
        {
          employee_id: 'e1',
          company_id: 'c1',
          company: {
            working_days: [
              {
                sunday: true,
                monday: true,
                tuesday: true,
                wednesday: true,
                thursday: true,
                friday: true,
                saturday: true,
              },
            ],
            custom_holidays: [
              {
                company_custom_holiday_id: 'h1',
                // isi apapun; di service kamu cuma cek length > 0
              },
            ],
          },
        },
      ]);

      prisma.employeeAttendance.findMany.mockResolvedValue([]);

      await service.handleAutoAbsent();

      expect(prisma.employeeAttendance.createMany).not.toHaveBeenCalled();
    });

    it('should not call createMany when toCreate is empty', async () => {
      freezeNow('2025-12-29T10:00:00.000Z');

      prisma.employee.findMany.mockResolvedValue([
        {
          employee_id: 'e1',
          company_id: 'c1',
          company: {
            working_days: [], // workingDay missing => continue
            custom_holidays: [],
          },
        },
      ]);

      prisma.employeeAttendance.findMany.mockResolvedValue([]);

      await service.handleAutoAbsent();

      expect(prisma.employeeAttendance.createMany).not.toHaveBeenCalled();
    });
  });
});
