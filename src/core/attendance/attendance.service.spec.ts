// attendance.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceService } from './attendance.service';

import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

import { FaceRecognitionService } from '../face-recognition/face-recognition.service';
import { EmployeeService } from '../employee/employee.service';
import { CompanyService } from '../company/company.service';
import { SubscriptionService } from '../subscription/subscription.service';

import { Prisma } from 'generated/prisma';

// ✅ Mock date utils: kita bikin deterministik
jest.mock('src/utils/date.utils', () => {
  const today = new Date('2026-01-01T00:00:00.000Z');
  return {
    startOfDay: jest.fn(() => today),
    dateOnlyUtc: jest.fn(
      (d: Date) =>
        new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
    ),
    addDaysUtc: jest.fn(
      (d: Date, n: number) => new Date(d.getTime() + n * 86400000),
    ),
    toYmd: jest.fn((d: Date) => d.toISOString().slice(0, 10)),
    parseIsoDateOrTodayUtc: jest.fn((s?: string) =>
      s ? new Date(`${s}T00:00:00.000Z`) : today,
    ),
    nowMinutesJakarta: jest.fn((_now: Date) => 8 * 60), // 08:00
    timeToMinutesFromDb: jest.fn(
      (t: Date) => t.getHours() * 60 + t.getMinutes(),
    ),
  };
});

describe('AttendanceService', () => {
  let service: AttendanceService;

  // ======= Mocks =======
  const txFactory = () => ({
    employee: {
      findUnique: jest.fn(),
    },
    employeeAttendance: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    attendanceLog: {
      create: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $executeRaw: jest.fn(),
    $executeRawUnsafe: jest.fn(),
    $queryRaw: jest.fn(),
  });

  const prisma = {
    $transaction: jest.fn(),
    employee: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    employeeAttendance: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const faceRecognitionService = {
    verifyFace: jest.fn(),
  };

  const employeeService = {
    getEmployeeByIdIncludeCompany: jest.fn(),
  };

  const companyService = {
    getCompanyById: jest.fn(),
    getAvailableSeats: jest.fn(),
  };

  const subscriptionService = {
    getSubscriptionStatus: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: FaceRecognitionService, useValue: faceRecognitionService },
        { provide: EmployeeService, useValue: employeeService },
        { provide: CompanyService, useValue: companyService },
        { provide: SubscriptionService, useValue: subscriptionService },
      ],
    }).compile();

    service = module.get(AttendanceService);
  });

  const companyBase = {
    company_id: 'c1',
    recognize_with_gesture: false,
    attendance_location_enabled: false,
    attendance_radius_meters: 100,
    work_start_time: new Date('1970-01-01T08:00:00.000Z'),
    attendance_open_time: new Date('1970-01-01T07:00:00.000Z'),
    attendance_close_time: new Date('1970-01-01T23:00:00.000Z'),
    attendance_tolerance_minutes: 0,
    minimum_hours_per_day: 0,
  };

  // helper: jalankan $transaction
  const mockTransaction = (handler: (tx: any) => any) => {
    prisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = txFactory();
      return cb(tx);
    });
    return handler;
  };

  describe('checkInFace', () => {
    it('should create attendance when valid (no gesture, no location)', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });

      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });

      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = txFactory();

        tx.employee.findUnique.mockResolvedValue({
          company: {
            ...companyBase,
            recognize_with_gesture: false,
            attendance_location_enabled: false,
          },
        });

        tx.employeeAttendance.findFirst.mockResolvedValue(null); // belum check-in
        tx.employeeAttendance.create.mockResolvedValue({
          employee_attendance_id: 'a1',
        });

        tx.employeeAttendance.findUnique.mockResolvedValue({
          employee_attendance_id: 'a1',
          employee_id: 'e1',
        });

        return cb(tx);
      });

      const res = await service.checkInFace(
        { buffer: Buffer.from('x') } as any,
        'e1',
        { latitude: '1', longitude: '2' } as any,
      );

      expect(subscriptionService.getSubscriptionStatus).toHaveBeenCalledWith(
        'c1',
      );
      expect(faceRecognitionService.verifyFace).toHaveBeenCalledTimes(1);

      expect(res).toEqual({
        employee_attendance_id: 'a1',
        employee_id: 'e1',
      });
    });

    it('should throw when already checked in today', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });

      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });

      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = txFactory();

        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase },
        });

        tx.employeeAttendance.findFirst.mockResolvedValue({
          employee_attendance_id: 'a-existing',
        });

        return cb(tx);
      });

      await expect(
        service.checkInFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw when gesture payload sent but company recognize_with_gesture OFF', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });

      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = txFactory();

        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase, recognize_with_gesture: false },
        });

        return cb(tx);
      });

      await expect(
        service.checkInFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
          gesture: ['Smile'],
          hand: ['Left'],
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw when company recognize_with_gesture ON but plan level < 1 and payload sent', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });

      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = txFactory();

        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase, recognize_with_gesture: true },
        });

        return cb(tx);
      });

      await expect(
        service.checkInFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
          gesture: ['Smile'],
          hand: ['Left'],
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw when gesture expected but detected mismatch', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 1,
      });

      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [{ hand: 'Left', gesture: 'Wave' }], // mismatch
      });

      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = txFactory();

        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase, recognize_with_gesture: true },
        });

        return cb(tx);
      });

      await expect(
        service.checkInFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
          gesture: ['Smile'],
          hand: ['Left'],
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should enforce location radius when enabled and outside radius', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });

      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });

      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = txFactory();

        tx.employee.findUnique.mockResolvedValue({
          company: {
            ...companyBase,
            attendance_location_enabled: true,
            attendance_radius_meters: 50,
          },
        });

        tx.$queryRaw.mockResolvedValue([
          { has_location: true, in_radius: false },
        ]);

        return cb(tx);
      });

      await expect(
        service.checkInFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('checkOutFace', () => {
    it('should throw when no open attendance (not checked in)', async () => {
      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });

      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });

      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = txFactory();

        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase },
        });

        tx.employeeAttendance.findFirst.mockResolvedValue(null);

        return cb(tx);
      });

      await expect(
        service.checkOutFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw when existing status is not PRESENT', async () => {
      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });

      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });

      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = txFactory();

        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase },
        });

        tx.employeeAttendance.findFirst.mockResolvedValue({
          employee_attendance_id: 'a1',
          check_in_time: new Date('2026-01-01T08:00:00.000Z'),
          is_late: false,
          status: 'SICK',
        });

        return cb(tx);
      });

      await expect(
        service.checkOutFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should update check_out_time when valid and log', async () => {
      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });

      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });

      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = txFactory();

        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase, minimum_hours_per_day: 0 },
        });

        tx.employeeAttendance.findFirst.mockResolvedValue({
          employee_attendance_id: 'a1',
          check_in_time: new Date('2026-01-01T08:00:00.000Z'),
          is_late: true,
          status: 'PRESENT',
        });

        tx.employeeAttendance.update.mockResolvedValue({
          employee_attendance_id: 'a1',
        });

        tx.employeeAttendance.findUnique.mockResolvedValue({
          employee_attendance_id: 'a1',
          check_out_time: new Date('2026-01-01T10:00:00.000Z'),
        });

        return cb(tx);
      });

      const res = await service.checkOutFace(
        { buffer: Buffer.from('x') } as any,
        'e1',
        { latitude: '1', longitude: '2' } as any,
      );

      expect(res).toMatchObject({
        employee_attendance_id: 'a1',
      });
    });

    it('should enforce minimum work hours', async () => {
      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });

      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });

      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = txFactory();

        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase, minimum_hours_per_day: 10 }, // besar biar gagal
        });

        tx.employeeAttendance.findFirst.mockResolvedValue({
          employee_attendance_id: 'a1',
          check_in_time: new Date(), // checkin now -> worked kecil
          is_late: true,
          status: 'PRESENT',
        });

        return cb(tx);
      });

      await expect(
        service.checkOutFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('canEmployeeCheckIn', () => {
    it('should return false when already checked in today', async () => {
      employeeService.getEmployeeByIdIncludeCompany.mockResolvedValue({
        employee_id: 'e1',
        company: { ...companyBase },
      });

      prisma.employeeAttendance.findFirst.mockResolvedValue({
        employee_attendance_id: 'a1',
      });

      const res = await service.canEmployeeCheckIn('e1');

      expect(res.can_check_in).toBe(false);
      expect(res.reason).toBe('Already checked in today');
    });

    it('should return true when no attendance yet', async () => {
      employeeService.getEmployeeByIdIncludeCompany.mockResolvedValue({
        employee_id: 'e1',
        company: { ...companyBase },
      });

      prisma.employeeAttendance.findFirst.mockResolvedValue(null);

      const res = await service.canEmployeeCheckIn('e1');

      expect(res.can_check_in).toBe(true);
      expect(res.reason).toBeNull();
    });
  });

  describe('canEmployeeCheckOut', () => {
    it('should return false when not checked in today', async () => {
      employeeService.getEmployeeByIdIncludeCompany.mockResolvedValue({
        employee_id: 'e1',
        company: { ...companyBase, minimum_hours_per_day: 8 },
      });

      prisma.employeeAttendance.findFirst.mockResolvedValue(null);

      const res = await service.canEmployeeCheckOut('e1');

      expect(res.can_check_out).toBe(false);
      expect(res.reason).toBe('Not checked in today');
    });

    it('should return false when already checked out', async () => {
      employeeService.getEmployeeByIdIncludeCompany.mockResolvedValue({
        employee_id: 'e1',
        company: { ...companyBase, minimum_hours_per_day: 8 },
      });

      prisma.employeeAttendance.findFirst.mockResolvedValue({
        check_in_time: new Date(),
        check_out_time: new Date(),
        total_work_hours: 8,
        is_late: true,
      });

      const res = await service.canEmployeeCheckOut('e1');

      expect(res.can_check_out).toBe(false);
      expect(res.reason).toBe('Already checked out today');
    });
  });

  describe('getAttendanceSetting', () => {
    it('should return setting + attendance_location', async () => {
      prisma.company.findUnique.mockResolvedValue({
        minimum_hours_per_day: 8,
        attendance_open_time: null,
        attendance_close_time: null,
        work_start_time: null,
        payroll_day_of_month: 25,
        recognize_with_gesture: false,
        attendance_tolerance_minutes: 0,
        attendance_location_enabled: false,
        attendance_radius_meters: null,
      });

      prisma.$queryRaw.mockResolvedValue([{ latitude: null, longitude: null }]);

      const res = await service.getAttendanceSetting('c1');

      expect(res).toMatchObject({
        minimum_hours_per_day: 8,
        payroll_day_of_month: 25,
        attendance_location: { latitude: null, longitude: null },
      });
    });
  });

  describe('updateAttendanceSetting', () => {
    it('should throw when enable gesture but plan level < 1', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });

      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = txFactory();
        return cb(tx);
      });

      await expect(
        service.updateAttendanceSetting('c1', {
          recognize_with_gesture: true,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw when location enabled but latitude/longitude missing', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 2,
      });

      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = txFactory();
        tx.company.update.mockResolvedValue({});
        return cb(tx);
      });

      await expect(
        service.updateAttendanceSetting('c1', {
          attendance_location_enabled: true,
          attendance_radius_meters: 50,
          // missing lat/lng
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should update company and return merged location', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 2,
      });

      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = txFactory();

        tx.company.update.mockResolvedValue({});

        tx.$executeRaw.mockResolvedValue({});
        tx.$queryRaw.mockResolvedValue([{ latitude: -6.2, longitude: 106.8 }]);

        tx.company.findUnique.mockResolvedValue({
          minimum_hours_per_day: 8,
          attendance_open_time: null,
          attendance_close_time: null,
          work_start_time: null,
          attendance_tolerance_minutes: 0,
          attendance_location_enabled: true,
          attendance_radius_meters: 50,
        });

        return cb(tx);
      });

      const res = await service.updateAttendanceSetting('c1', {
        minimum_hours_per_day: 8,
        attendance_location_enabled: true,
        attendance_radius_meters: 50,
        latitude: -6.2,
        longitude: 106.8,
      } as any);

      expect(res).toMatchObject({
        minimum_hours_per_day: 8,
        attendance_location_enabled: true,
        attendance_location: { latitude: -6.2, longitude: 106.8 },
      });
    });
  });
});
