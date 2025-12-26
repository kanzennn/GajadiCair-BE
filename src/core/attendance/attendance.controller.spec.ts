// attendance.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

// 1) Mock successResponse biar gampang di-assert
jest.mock('src/utils/response.utils', () => ({
  successResponse: jest.fn((data: any, message: string, code?: number) => ({
    success: true,
    message,
    data,
    code: code ?? 200,
  })),
}));

// 2) IMPORTANT: mock AttendanceService MODULE sebelum controller di-import
//    Ini mencegah Bun nge-load attendance.service.ts (yang nyeret subscription.service.ts)
jest.mock('./attendance.service', () => {
  class AttendanceService {}
  return { AttendanceService };
});

// 3) Dynamic import setelah mock (biar mock kepakai)
const { AttendanceController } = await import('./attendance.controller');
const { AttendanceService } = await import('./attendance.service');
const { successResponse } = await import('src/utils/response.utils');

describe('AttendanceController', () => {
  let controller: InstanceType<typeof AttendanceController>;
  let service: jest.Mocked<any>;

  const mockService = {
    checkInFace: jest.fn(),
    checkOutFace: jest.fn(),
    getAllAttendance: jest.fn(),
    getTodayAttendanceStatus: jest.fn(),
    canEmployeeCheckOut: jest.fn(),
    canEmployeeCheckIn: jest.fn(),
    getAttendanceSetting: jest.fn(),
    updateAttendanceSetting: jest.fn(),
    getAttendanceSummaryByCompany: jest.fn(),
    getAttendanceByCompany: jest.fn(),
    updateAttendanceByCompany: jest.fn(),
    getAttendanceSummaryByEmployee: jest.fn(),
  };

  const reqEmployee = (sub = 'emp-1') => ({ user: { sub } }) as any;
  const reqCompany = (sub = 'comp-1') => ({ user: { sub } }) as any;

  const mockFile = () =>
    ({
      originalname: 'face.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('x'),
      size: 1,
      fieldname: 'file',
      encoding: '7bit',
      destination: '',
      filename: '',
      path: '',
    }) as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [{ provide: AttendanceService, useValue: mockService }],
    }).compile();

    controller = module.get(AttendanceController);
    service = module.get(AttendanceService);
  });

  describe('checkInFace', () => {
    it('throws if file missing', async () => {
      await expect(
        controller.checkInFace(undefined as any, reqEmployee(), {
          latitude: 1,
          longitude: 1,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('calls service.checkInFace and returns successResponse', async () => {
      service.checkInFace.mockResolvedValue({ ok: true });

      const res = await controller.checkInFace(
        mockFile(),
        reqEmployee('emp-123'),
        { latitude: 1, longitude: 2 } as any,
      );

      expect(service.checkInFace).toHaveBeenCalledWith(
        expect.any(Object),
        'emp-123',
        { latitude: 1, longitude: 2 },
      );

      expect(successResponse).toHaveBeenCalledWith(
        { ok: true },
        'Check-in successful',
      );

      expect(res).toEqual({
        success: true,
        message: 'Check-in successful',
        data: { ok: true },
        code: 200,
      });
    });
  });

  describe('checkOutFace', () => {
    it('throws if file missing', async () => {
      await expect(
        controller.checkOutFace(undefined as any, reqEmployee(), {
          latitude: 1,
          longitude: 1,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('calls service.checkOutFace and returns successResponse', async () => {
      service.checkOutFace.mockResolvedValue({ ok: true });

      const res = await controller.checkOutFace(
        mockFile(),
        reqEmployee('emp-123'),
        { latitude: 1, longitude: 2 } as any,
      );

      expect(service.checkOutFace).toHaveBeenCalledWith(
        expect.any(Object),
        'emp-123',
        { latitude: 1, longitude: 2 },
      );

      expect(successResponse).toHaveBeenCalledWith(
        { ok: true },
        'Check-out successful',
      );

      expect(res.data).toEqual({ ok: true });
    });
  });

  describe('getAttendanceHistories', () => {
    it('calls service.getAllAttendance', async () => {
      service.getAllAttendance.mockResolvedValue([{ id: 1 }]);

      const res = await controller.getAttendanceHistories(
        reqEmployee('emp-123'),
      );

      expect(service.getAllAttendance).toHaveBeenCalledWith('emp-123');
      expect(successResponse).toHaveBeenCalledWith(
        [{ id: 1 }],
        'Attendance histories retrieved successfully',
      );
      expect(res.data).toEqual([{ id: 1 }]);
    });
  });

  describe('getTodayAttendanceStatus', () => {
    it('calls service.getTodayAttendanceStatus', async () => {
      service.getTodayAttendanceStatus.mockResolvedValue({ status: 'PRESENT' });

      const res = await controller.getTodayAttendanceStatus(
        reqEmployee('emp-123'),
      );

      expect(service.getTodayAttendanceStatus).toHaveBeenCalledWith('emp-123');
      expect(successResponse).toHaveBeenCalledWith(
        { status: 'PRESENT' },
        'Today attendance status retrieved successfully',
      );
      expect(res.data).toEqual({ status: 'PRESENT' });
    });
  });

  describe('checkIfEmployeeCanCheckOut', () => {
    it('calls service.canEmployeeCheckOut', async () => {
      service.canEmployeeCheckOut.mockResolvedValue({ can_check_out: true });

      const res = await controller.checkIfEmployeeCanCheckOut(
        reqEmployee('emp-123'),
      );

      expect(service.canEmployeeCheckOut).toHaveBeenCalledWith('emp-123');
      expect(successResponse).toHaveBeenCalledWith(
        { can_check_out: true },
        'Check-out eligibility retrieved successfully',
      );
      expect(res.data).toEqual({ can_check_out: true });
    });
  });

  describe('checkIfEmployeeCanCheckIn', () => {
    it('calls service.canEmployeeCheckIn', async () => {
      service.canEmployeeCheckIn.mockResolvedValue({ can_check_in: true });

      const res = await controller.checkIfEmployeeCanCheckIn(
        reqEmployee('emp-123'),
      );

      expect(service.canEmployeeCheckIn).toHaveBeenCalledWith('emp-123');
      expect(successResponse).toHaveBeenCalledWith(
        { can_check_in: true },
        'Check-in eligibility retrieved successfully',
      );
      expect(res.data).toEqual({ can_check_in: true });
    });
  });

  describe('getAttendanceSetting', () => {
    it('calls service.getAttendanceSetting', async () => {
      service.getAttendanceSetting.mockResolvedValue({
        minimum_hours_per_day: 8,
      });

      const res = await controller.getAttendanceSetting(reqCompany('comp-123'));

      expect(service.getAttendanceSetting).toHaveBeenCalledWith('comp-123');
      expect(successResponse).toHaveBeenCalledWith(
        { minimum_hours_per_day: 8 },
        'Attendance setting retrieved successfully',
      );
      expect(res.data).toEqual({ minimum_hours_per_day: 8 });
    });
  });

  describe('updateAttendanceSetting', () => {
    it('calls service.updateAttendanceSetting', async () => {
      service.updateAttendanceSetting.mockResolvedValue({ updated: true });

      const dto = { minimum_hours_per_day: 7 } as any;
      const res = await controller.updateAttendanceSetting(
        reqCompany('comp-123'),
        dto,
      );

      expect(service.updateAttendanceSetting).toHaveBeenCalledWith(
        'comp-123',
        dto,
      );
      expect(successResponse).toHaveBeenCalledWith(
        { updated: true },
        'Attendance setting retrieved successfully',
      );
      expect(res.data).toEqual({ updated: true });
    });
  });

  describe('getAttendanceSummaryByCompany', () => {
    it('calls service.getAttendanceSummaryByCompany', async () => {
      service.getAttendanceSummaryByCompany.mockResolvedValue({
        range: { start_date: '2025-01-01', end_date: '2025-01-07' },
      });

      const query = { start_date: '2025-01-01', end_date: '2025-01-07' } as any;
      const res = await controller.getAttendanceSummaryByCompany(
        reqCompany('comp-123'),
        query,
      );

      expect(service.getAttendanceSummaryByCompany).toHaveBeenCalledWith(
        'comp-123',
        query,
      );
      expect(successResponse).toHaveBeenCalledWith(
        { range: { start_date: '2025-01-01', end_date: '2025-01-07' } },
        'Company attendance records retrieved successfully',
      );
      expect(res.data).toEqual({
        range: { start_date: '2025-01-01', end_date: '2025-01-07' },
      });
    });
  });

  describe('getAttendanceByCompany', () => {
    it('calls service.getAttendanceByCompany', async () => {
      service.getAttendanceByCompany.mockResolvedValue({
        date: '2025-01-01',
        employees: [],
      });

      const query = { date: '2025-01-01' } as any;
      const res = await controller.getAttendanceByCompany(
        reqCompany('comp-123'),
        query,
      );

      expect(service.getAttendanceByCompany).toHaveBeenCalledWith(
        'comp-123',
        query,
      );
      expect(successResponse).toHaveBeenCalledWith(
        { date: '2025-01-01', employees: [] },
        'Company attendance records retrieved successfully',
      );
      expect(res.data).toEqual({ date: '2025-01-01', employees: [] });
    });
  });

  describe('updateAttendanceByCompany', () => {
    it('calls service.updateAttendanceByCompany', async () => {
      service.updateAttendanceByCompany.mockResolvedValue({
        employee_attendance_id: 'att-1',
      });

      const dto = { employee_attendance_id: 'att-1', status: 'PRESENT' } as any;
      const res = await controller.updateAttendanceByCompany(
        reqCompany('comp-123'),
        dto,
      );

      expect(service.updateAttendanceByCompany).toHaveBeenCalledWith(
        'comp-123',
        dto,
      );
      expect(successResponse).toHaveBeenCalledWith(
        { employee_attendance_id: 'att-1' },
        'Company attendance record updated successfully',
      );
      expect(res.data).toEqual({ employee_attendance_id: 'att-1' });
    });
  });

  describe('getAttendanceSummaryByEmployee', () => {
    it('calls service.getAttendanceSummaryByEmployee', async () => {
      service.getAttendanceSummaryByEmployee.mockResolvedValue({
        employee: { employee_id: 'emp-1' },
      });

      const query = { month: 1, year: 2025 } as any;
      const res = await controller.getAttendanceSummaryByEmployee(
        reqEmployee('emp-123'),
        query,
      );

      expect(service.getAttendanceSummaryByEmployee).toHaveBeenCalledWith(
        'emp-123',
        query,
      );
      expect(successResponse).toHaveBeenCalledWith(
        { employee: { employee_id: 'emp-1' } },
        'Employee attendance summary retrieved successfully',
      );
      expect(res.data).toEqual({ employee: { employee_id: 'emp-1' } });
    });
  });
});
