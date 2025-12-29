import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

// Helper: buat Date UTC stabil
const utc = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d));

// Mock startOfDay() biar deterministic (opsional tapi sangat membantu)
jest.mock('src/utils/date.utils', () => ({
  startOfDay: () => new Date('2025-12-28T00:00:00.000Z'),
}));

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    employee: { count: jest.Mock; findFirst: jest.Mock };
    employeeAttendance: {
      count: jest.Mock;
      findFirst: jest.Mock;
      groupBy: jest.Mock;
      findMany: jest.Mock;
    };
    employeeLeaveApplication: { count: jest.Mock };
    payrollLog: { findFirst: jest.Mock };
    attendanceLog: { findMany: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      employee: {
        count: jest.fn(),
        findFirst: jest.fn(),
      },
      employeeAttendance: {
        count: jest.fn(),
        findFirst: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
      },
      employeeLeaveApplication: {
        count: jest.fn(),
      },
      payrollLog: {
        findFirst: jest.fn(),
      },
      attendanceLog: {
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===================== getDataDashboardByCompany =====================

  describe('getDataDashboardByCompany', () => {
    it('should return aggregated dashboard data (company)', async () => {
      prisma.employee.count
        .mockResolvedValueOnce(10) // total_employee
        .mockResolvedValueOnce(3); // employeeHasNotCheckInToday

      prisma.employeeAttendance.count
        .mockResolvedValueOnce(6) // employeePresentToday
        .mockResolvedValueOnce(2); // employeeHasNotCheckedOut

      prisma.attendanceLog.findMany.mockResolvedValueOnce([
        { id: 1 },
        { id: 2 },
      ]);

      const res = await service.getDataDashboardByCompany('c1');

      expect(res).toEqual({
        total_employee: 10,
        employeePresentToday: 6,
        employeeHasNotCheckInToday: 3,
        employeeHasNotCheckedOut: 2,
        attendanceLog: [{ id: 1 }, { id: 2 }],
      });

      expect(prisma.employee.count).toHaveBeenCalledTimes(2);
      expect(prisma.employeeAttendance.count).toHaveBeenCalledTimes(2);
      expect(prisma.attendanceLog.findMany).toHaveBeenCalledTimes(1);
    });
  });

  // ===================== getDataDashboardByEmployee =====================

  describe('getDataDashboardByEmployee', () => {
    it('should return fallback when employee not found', async () => {
      prisma.employee.findFirst.mockResolvedValueOnce(null);

      const res = await service.getDataDashboardByEmployee('e1');

      expect(res).toEqual({
        today: null,
        company: null,
        summary_month: null,
        recent_attendances: [],
        leave_applications: { pending: 0 },
        payroll: { latest: null },
      });
    });

    it('should compute summary_month correctly', async () => {
      prisma.employee.findFirst.mockResolvedValueOnce({
        employee_id: 'e1',
        name: 'A',
        email: 'a@mail.com',
        username: 'a',
        avatar_uri: null,
        is_face_enrolled: true,
        company: { company_id: 'c1', name: 'C', company_identifier: 'CID' },
      });

      prisma.employeeAttendance.findFirst.mockResolvedValueOnce({
        status: 'PRESENT',
        check_in_time: new Date('2025-12-28T01:00:00.000Z'),
        check_out_time: null,
        is_late: false,
        late_minutes: null,
        total_work_hours: null,
      });

      // monthAgg: PRESENT(not late)=2, PRESENT(late)=1, ABSENT=3
      prisma.employeeAttendance.groupBy.mockResolvedValueOnce([
        { status: 'PRESENT', is_late: false, _count: { _all: 2 } },
        { status: 'PRESENT', is_late: true, _count: { _all: 1 } },
        { status: 'ABSENT', is_late: false, _count: { _all: 3 } },
      ]);

      prisma.employeeAttendance.findMany.mockResolvedValueOnce([
        {
          attendance_date: new Date('2025-12-28T00:00:00.000Z'),
          status: 'PRESENT',
          check_in_time: new Date('2025-12-28T01:00:00.000Z'),
          check_out_time: null,
          is_late: false,
          late_minutes: null,
          total_work_hours: null,
        },
      ]);

      prisma.employeeLeaveApplication.count.mockResolvedValueOnce(5);

      prisma.payrollLog.findFirst.mockResolvedValueOnce({
        payroll_date: new Date('2025-12-01T00:00:00.000Z'),
        amount: 123,
        pdf_uri: 'x.pdf',
      });

      const res = await service.getDataDashboardByEmployee('e1');

      expect(res.summary_month.PRESENT).toBe(2);
      expect(res.summary_month.LATE).toBe(1);
      expect(res.summary_month.ABSENT).toBe(3);
      expect(res.summary_month.total_days).toBe(6);

      expect(res.leave_applications.pending).toBe(5);
      expect(res.payroll.latest.amount).toBe(123);
      expect(res.today.has_checked_in).toBe(true);
      expect(res.today.has_checked_out).toBe(false);
    });
  });

  // ===================== getDataChartByCompany =====================

  describe('getDataChartByCompany', () => {
    it('should throw if both range and days provided', async () => {
      await expect(
        service.getDataChartByCompany('c1', {
          start_date: '2025-12-01',
          end_date: '2025-12-10',
          days: 7,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw if only start_date provided', async () => {
      await expect(
        service.getDataChartByCompany('c1', {
          start_date: '2025-12-01',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should return chart output with day granularity (<= 31 days)', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          period: utc(2025, 12, 1),
          present: 1,
          late: 0,
          absent: 0,
          leave: 0,
          sick: 0,
          total: 1,
        },
        {
          period: utc(2025, 12, 2),
          present: 0,
          late: 1,
          absent: 0,
          leave: 0,
          sick: 0,
          total: 1,
        },
      ]);

      const res = await service.getDataChartByCompany('c1', {
        start_date: '2025-12-01',
        end_date: '2025-12-02',
      } as any);

      expect(res.granularity).toBe('day');
      expect(res.range).toEqual({
        start: '2025-12-01',
        end: '2025-12-02',
        days: 2,
      });
      expect(res.labels).toEqual(['2025-12-01', '2025-12-02']);
      expect(res.series.PRESENT).toEqual([1, 0]);
      expect(res.series.LATE).toEqual([0, 1]);
      expect(res.series.total).toEqual([1, 1]);
    });

    it('should pick week granularity for > 31 and <= 180 days', async () => {
      // cukup cek granularity, rows boleh 1 bucket aja
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          period: utc(2025, 1, 1),
          present: 0,
          late: 0,
          absent: 0,
          leave: 0,
          sick: 0,
          total: 0,
        },
      ]);

      const res = await service.getDataChartByCompany(
        'c1',
        { start_date: '2025-01-01', end_date: '2025-03-01' } as any, // 60 hari (inclusive ~)
      );

      expect(res.granularity).toBe('week');
    });

    it('should pick month granularity for > 180 days', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          period: utc(2025, 1, 1),
          present: 0,
          late: 0,
          absent: 0,
          leave: 0,
          sick: 0,
          total: 0,
        },
      ]);

      const res = await service.getDataChartByCompany('c1', {
        start_date: '2025-01-01',
        end_date: '2025-10-01',
      } as any);

      expect(res.granularity).toBe('month');
    });
  });

  // ===================== getDataChartByEmployee =====================

  describe('getDataChartByEmployee', () => {
    it('should throw if days <= 0', async () => {
      await expect(
        service.getDataChartByEmployee('e1', { days: 0 } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should return chart output (employee)', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          period: utc(2025, 12, 25),
          present: 0,
          late: 0,
          absent: 0,
          leave: 0,
          sick: 0,
          total: 0,
        },
        {
          period: utc(2025, 12, 26),
          present: 1,
          late: 0,
          absent: 0,
          leave: 0,
          sick: 0,
          total: 1,
        },
      ]);

      const res = await service.getDataChartByEmployee('e1', {
        start_date: '2025-12-25',
        end_date: '2025-12-26',
      } as any);

      expect(res.granularity).toBe('day');
      expect(res.labels).toEqual(['2025-12-25', '2025-12-26']);
      expect(res.series.total).toEqual([0, 1]);
      expect(res.points[1]).toEqual({
        period: '2025-12-26',
        PRESENT: 1,
        LATE: 0,
        ABSENT: 0,
        LEAVE: 0,
        SICK: 0,
        total: 1,
      });
    });
  });
});
