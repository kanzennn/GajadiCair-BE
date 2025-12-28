/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { DashboardService } from './dashboard.service';

// Mock startOfDay agar stabil
jest.mock('src/utils/date.utils', () => ({
  startOfDay: jest.fn(() => new Date('2025-12-28T00:00:00.000Z')),
}));

describe('DashboardService', () => {
  let service: DashboardService;

  const prisma = {
    employee: {
      count: jest.fn(),
    },
    employeeAttendance: {
      count: jest.fn(),
    },
    attendanceLog: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  describe('getDataDashboard', () => {
    it('should return dashboard summary (counts + attendance logs)', async () => {
      prisma.employee.count
        .mockResolvedValueOnce(10) // total_employee
        .mockResolvedValueOnce(3); // employeeHasNotCheckInToday

      prisma.employeeAttendance.count
        .mockResolvedValueOnce(7) // employeePresentToday
        .mockResolvedValueOnce(2); // employeeHasNotCheckedOut

      prisma.attendanceLog.findMany.mockResolvedValue([
        {
          attendance_log_id: 'l1',
          employee_id: 'e1',
          log_type: 0,
          timestamp: new Date('2025-12-28T01:00:00.000Z'),
          employee: {
            employee_id: 'e1',
            name: 'Emp 1',
            company_id: 'c1',
          },
        },
      ]);

      const res = await service.getDataDashboard('c1');

      // total employee active
      expect(prisma.employee.count).toHaveBeenNthCalledWith(1, {
        where: { company_id: 'c1', is_active: true, deleted_at: null },
      });

      // present today
      expect(prisma.employeeAttendance.count).toHaveBeenNthCalledWith(1, {
        where: {
          employee: { company_id: 'c1', deleted_at: null },
          attendance_date: new Date('2025-12-28T00:00:00.000Z'),
          status: 'PRESENT',
        },
      });

      // not check-in today: none attendance record today
      expect(prisma.employee.count).toHaveBeenNthCalledWith(2, {
        where: {
          company_id: 'c1',
          is_active: true,
          deleted_at: null,
          attendances: {
            none: {
              attendance_date: new Date('2025-12-28T00:00:00.000Z'),
            },
          },
        },
      });

      // not checked out
      expect(prisma.employeeAttendance.count).toHaveBeenNthCalledWith(2, {
        where: {
          employee: { company_id: 'c1' },
          attendance_date: new Date('2025-12-28T00:00:00.000Z'),
          check_in_time: { not: null },
          check_out_time: null,
        },
      });

      // logs
      expect(prisma.attendanceLog.findMany).toHaveBeenCalledWith({
        where: { employee: { company_id: 'c1' } },
        include: { employee: true },
      });

      expect(res).toEqual({
        total_employee: 10,
        employeePresentToday: 7,
        employeeHasNotCheckInToday: 3,
        employeeHasNotCheckedOut: 2,
        attendanceLog: expect.any(Array),
      });
    });
  });

  describe('getDataChart - validation', () => {
    it('should throw if both range and days are provided', async () => {
      await expect(
        service.getDataChart('c1', {
          start_date: '2025-12-01',
          end_date: '2025-12-10',
          days: 7,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw if only one of start_date/end_date is provided', async () => {
      await expect(
        service.getDataChart('c1', {
          start_date: '2025-12-01',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.getDataChart('c1', {
          end_date: '2025-12-10',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw if start_date > end_date', async () => {
      await expect(
        service.getDataChart('c1', {
          start_date: '2025-12-10',
          end_date: '2025-12-01',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getDataChart - output formatting', () => {
    it('should return daily chart when rangeDays <= 31 (days param)', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          period: new Date('2025-12-26T00:00:00.000Z'),
          PRESENT: 5,
          LATE: 1,
          ABSENT: 0,
          LEAVE: 0,
          SICK: 0,
          total: 6,
        },
        {
          period: new Date('2025-12-27T00:00:00.000Z'),
          PRESENT: 4,
          LATE: 0,
          ABSENT: 1,
          LEAVE: 1,
          SICK: 0,
          total: 6,
        },
      ]);

      const res = await service.getDataChart('c1', { days: 7 } as any);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

      expect(res.granularity).toBe('day');
      expect(res.labels).toEqual(['2025-12-26', '2025-12-27']);

      expect(res.series).toEqual({
        PRESENT: [5, 4],
        LATE: [1, 0],
        ABSENT: [0, 1],
        LEAVE: [0, 1],
        SICK: [0, 0],
        total: [6, 6],
      });

      expect(res.points[0]).toEqual({
        period: '2025-12-26',
        PRESENT: 5,
        LATE: 1,
        ABSENT: 0,
        LEAVE: 0,
        SICK: 0,
        total: 6,
      });
    });

    it('should return weekly granularity when rangeDays between 32..180', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          period: new Date('2025-09-29T00:00:00.000Z'),
          PRESENT: 40,
          LATE: 5,
          ABSENT: 2,
          LEAVE: 1,
          SICK: 0,
          total: 48,
        },
      ]);

      const res = await service.getDataChart('c1', { days: 60 } as any);

      expect(res.granularity).toBe('week');
      // week label dipakai start-of-bucket date
      expect(res.labels).toEqual(['2025-09-29']);
    });

    it('should return monthly granularity when rangeDays > 180', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          period: new Date('2025-01-01T00:00:00.000Z'),
          PRESENT: 100,
          LATE: 10,
          ABSENT: 5,
          LEAVE: 3,
          SICK: 2,
          total: 120,
        },
      ]);

      const res = await service.getDataChart('c1', { days: 365 } as any);

      expect(res.granularity).toBe('month');
      expect(res.labels).toEqual(['2025-01']);
    });

    it('should accept explicit date range and format labels accordingly', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          period: new Date('2025-12-01T00:00:00.000Z'),
          PRESENT: 1,
          LATE: 0,
          ABSENT: 0,
          LEAVE: 0,
          SICK: 0,
          total: 1,
        },
      ]);

      const res = await service.getDataChart('c1', {
        start_date: '2025-12-01',
        end_date: '2025-12-10',
      } as any);

      expect(res.range.start).toBe('2025-12-01');
      expect(res.range.end).toBe('2025-12-10');
      expect(res.labels).toEqual(['2025-12-01']);
    });
  });
});
