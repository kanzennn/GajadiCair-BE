// attendance.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';

import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

describe('AttendanceController', () => {
  let controller: AttendanceController;

  // ======= Mocks =======
  const attendanceService = {
    checkInFace: jest.fn(),
    checkOutFace: jest.fn(),
    getAllAttendance: jest.fn(),
    getTodayAttendanceStatus: jest.fn(),
    canEmployeeCheckOut: jest.fn(),
    canEmployeeCheckIn: jest.fn(),
    getAttendanceSummaryByEmployee: jest.fn(),

    getAttendanceSetting: jest.fn(),
    updateAttendanceSetting: jest.fn(),
    getAttendanceSummaryByCompany: jest.fn(),
    getAttendanceByCompany: jest.fn(),
    updateAttendanceByCompany: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [{ provide: AttendanceService, useValue: attendanceService }],
    }).compile();

    controller = module.get(AttendanceController);
  });

  const makeReq = (sub: string) => ({ user: { sub } }) as any;

  // ===================== EMPLOYEE =====================

  describe('checkInFace', () => {
    it('should throw when no file uploaded', async () => {
      await expect(
        controller.checkInFace(undefined as any, makeReq('e1'), {} as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(attendanceService.checkInFace).not.toHaveBeenCalled();
    });

    it('should call service and return success response', async () => {
      attendanceService.checkInFace.mockResolvedValue({ ok: true });

      const file = { originalname: 'a.jpg' } as any;
      const dto = { latitude: '1', longitude: '2' } as any;

      const res = await controller.checkInFace(file, makeReq('e1'), dto);

      expect(attendanceService.checkInFace).toHaveBeenCalledWith(
        file,
        'e1',
        dto,
      );

      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Check-in successful',
        data: { ok: true },
      });
    });
  });

  describe('checkOutFace', () => {
    it('should throw when no file uploaded', async () => {
      await expect(
        controller.checkOutFace(undefined as any, makeReq('e1'), {} as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(attendanceService.checkOutFace).not.toHaveBeenCalled();
    });

    it('should call service and return success response', async () => {
      attendanceService.checkOutFace.mockResolvedValue({ ok: true });

      const file = { originalname: 'a.jpg' } as any;
      const dto = { latitude: '1', longitude: '2' } as any;

      const res = await controller.checkOutFace(file, makeReq('e1'), dto);

      expect(attendanceService.checkOutFace).toHaveBeenCalledWith(
        file,
        'e1',
        dto,
      );

      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Check-out successful',
        data: { ok: true },
      });
    });
  });

  describe('getAttendanceHistories', () => {
    it('should return histories', async () => {
      attendanceService.getAllAttendance.mockResolvedValue([{ id: 1 }]);

      const res = await controller.getAttendanceHistories(makeReq('e1'));

      expect(attendanceService.getAllAttendance).toHaveBeenCalledWith('e1');
      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Attendance histories retrieved successfully',
        data: [{ id: 1 }],
      });
    });
  });

  describe('getTodayAttendanceStatus', () => {
    it('should return today status', async () => {
      attendanceService.getTodayAttendanceStatus.mockResolvedValue({
        status: 'PRESENT',
      });

      const res = await controller.getTodayAttendanceStatus(makeReq('e1'));

      expect(attendanceService.getTodayAttendanceStatus).toHaveBeenCalledWith(
        'e1',
      );
      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Today attendance status retrieved successfully',
        data: { status: 'PRESENT' },
      });
    });
  });

  describe('checkIfEmployeeCanCheckOut', () => {
    it('should return checkout eligibility', async () => {
      attendanceService.canEmployeeCheckOut.mockResolvedValue({
        can_check_out: true,
      });

      const res = await controller.checkIfEmployeeCanCheckOut(makeReq('e1'));

      expect(attendanceService.canEmployeeCheckOut).toHaveBeenCalledWith('e1');
      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Check-out eligibility retrieved successfully',
        data: { can_check_out: true },
      });
    });
  });

  describe('checkIfEmployeeCanCheckIn', () => {
    it('should return checkin eligibility', async () => {
      attendanceService.canEmployeeCheckIn.mockResolvedValue({
        can_check_in: true,
      });

      const res = await controller.checkIfEmployeeCanCheckIn(makeReq('e1'));

      expect(attendanceService.canEmployeeCheckIn).toHaveBeenCalledWith('e1');
      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Check-in eligibility retrieved successfully',
        data: { can_check_in: true },
      });
    });
  });

  describe('getAttendanceSummaryByEmployee', () => {
    it('should return employee summary', async () => {
      attendanceService.getAttendanceSummaryByEmployee.mockResolvedValue({
        summary: {},
      });

      const query = { month: 1, year: 2026 } as any;

      const res = await controller.getAttendanceSummaryByEmployee(
        makeReq('e1'),
        query,
      );

      expect(
        attendanceService.getAttendanceSummaryByEmployee,
      ).toHaveBeenCalledWith('e1', query);

      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Employee attendance summary retrieved successfully',
        data: { summary: {} },
      });
    });
  });

  // ===================== COMPANY =====================

  describe('getAttendanceSetting', () => {
    it('should return attendance setting', async () => {
      attendanceService.getAttendanceSetting.mockResolvedValue({
        attendance_open_time: null,
      });

      const res = await controller.getAttendanceSetting(makeReq('c1'));

      expect(attendanceService.getAttendanceSetting).toHaveBeenCalledWith('c1');
      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Attendance setting retrieved successfully',
        data: { attendance_open_time: null },
      });
    });
  });

  describe('updateAttendanceSetting', () => {
    it('should update and return attendance setting', async () => {
      attendanceService.updateAttendanceSetting.mockResolvedValue({
        updated: true,
      });

      const dto = { minimum_hours_per_day: 8 } as any;

      const res = await controller.updateAttendanceSetting(makeReq('c1'), dto);

      expect(attendanceService.updateAttendanceSetting).toHaveBeenCalledWith(
        'c1',
        dto,
      );

      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Attendance setting retrieved successfully',
        data: { updated: true },
      });
    });
  });

  describe('getAttendanceSummaryByCompany', () => {
    it('should return company summary', async () => {
      attendanceService.getAttendanceSummaryByCompany.mockResolvedValue({
        range: {},
      });

      const query = { start_date: '2026-01-01', end_date: '2026-01-07' } as any;

      const res = await controller.getAttendanceSummaryByCompany(
        makeReq('c1'),
        query,
      );

      expect(
        attendanceService.getAttendanceSummaryByCompany,
      ).toHaveBeenCalledWith('c1', query);

      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Company attendance records retrieved successfully',
        data: { range: {} },
      });
    });
  });

  describe('getAttendanceByCompany', () => {
    it('should return company attendance by date', async () => {
      attendanceService.getAttendanceByCompany.mockResolvedValue({
        date: '2026-01-01',
      });

      const query = { date: '2026-01-01' } as any;

      const res = await controller.getAttendanceByCompany(makeReq('c1'), query);

      expect(attendanceService.getAttendanceByCompany).toHaveBeenCalledWith(
        'c1',
        query,
      );

      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Company attendance records retrieved successfully',
        data: { date: '2026-01-01' },
      });
    });
  });

  describe('updateAttendanceByCompany', () => {
    it('should update company attendance record', async () => {
      attendanceService.updateAttendanceByCompany.mockResolvedValue({
        ok: true,
      });

      const dto = { employee_attendance_id: 'a1', status: 'PRESENT' } as any;

      const res = await controller.updateAttendanceByCompany(
        makeReq('c1'),
        dto,
      );

      expect(attendanceService.updateAttendanceByCompany).toHaveBeenCalledWith(
        'c1',
        dto,
      );

      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Company attendance record updated successfully',
        data: { ok: true },
      });
    });
  });
});
