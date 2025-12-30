// attendance.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceService } from './attendance.service';

import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

import { FaceRecognitionService } from '../face-recognition/face-recognition.service';
import { EmployeeService } from '../employee/employee.service';
import { CompanyService } from '../company/company.service';
import { SubscriptionService } from '../subscription/subscription.service';

// ✅ Mock date utils (deterministik)
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
    nowMinutesJakarta: jest.fn((_now: Date) => 8 * 60), // default 08:00
    timeToMinutesFromDb: jest.fn(
      (t: Date) => t.getHours() * 60 + t.getMinutes(),
    ),
  };
});

// ✅ IMPORTANT: ambil reference module mock agar bisa di-reset per test

const dateUtils = require('src/utils/date.utils');

type Tx = ReturnType<typeof txFactory>;

function txFactory() {
  return {
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
  };
}

describe('AttendanceService', () => {
  let service: AttendanceService;

  // ======= Root Prisma mock =======
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
      findUnique: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $executeRawUnsafe: jest.fn(),
  };

  const faceRecognitionService = {
    verifyFace: jest.fn(),
  };

  const employeeService = {
    getEmployeeByIdIncludeCompany: jest.fn(),
  };

  const companyService = {
    getCompanyById: jest.fn(),
  };

  const subscriptionService = {
    getSubscriptionStatus: jest.fn(),
  };

  const companyBase = {
    company_id: 'c1',
    recognize_with_gesture: false,
    attendance_location_enabled: false,
    attendance_radius_meters: 100,
    minimum_hours_per_day: 0,
    work_start_time: new Date('1970-01-01T08:00:00.000Z'),
    attendance_open_time: new Date('1970-01-01T07:00:00.000Z'),
    attendance_close_time: new Date('1970-01-01T23:00:00.000Z'),
    attendance_tolerance_minutes: 0,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // ✅ Freeze time for stability
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T08:00:00.000Z'));

    // ✅ CRITICAL FIX:
    // Reset nowMinutesJakarta per-test so overrides don't leak across tests.
    dateUtils.nowMinutesJakarta.mockImplementation(() => 8 * 60);

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

  afterEach(() => {
    jest.useRealTimers();
  });

  function mockTransaction(cbSetup: (tx: Tx) => Promise<void> | void) {
    prisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = txFactory();
      await cbSetup(tx);
      return cb(tx);
    });
  }

  // ===================== CHECK-IN / CHECK-OUT =====================

  describe('checkInFace', () => {
    it('T1 - creates attendance when valid (no gesture, no location)', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });
      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });

      mockTransaction(async (tx) => {
        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase },
        });

        tx.employeeAttendance.findFirst.mockResolvedValue(null);
        tx.employeeAttendance.create.mockResolvedValue({
          employee_attendance_id: 'a1',
        });

        tx.employeeAttendance.findUnique.mockResolvedValue({
          employee_attendance_id: 'a1',
          employee_id: 'e1',
        });
      });

      const res = await service.checkInFace(
        {
          buffer: Buffer.from('x'),
          originalname: 'x.jpg',
          mimetype: 'image/jpeg',
        } as any,
        'e1',
        { latitude: '1', longitude: '2' } as any,
      );

      expect(subscriptionService.getSubscriptionStatus).toHaveBeenCalledWith(
        'c1',
      );
      expect(faceRecognitionService.verifyFace).toHaveBeenCalledTimes(1);
      expect(res).toEqual({ employee_attendance_id: 'a1', employee_id: 'e1' });
    });

    it('T2 - throws when already checked in today', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });
      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });

      mockTransaction(async (tx) => {
        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase },
        });
        tx.employeeAttendance.findFirst.mockResolvedValue({
          employee_attendance_id: 'a-existing',
        });
      });

      await expect(
        service.checkInFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
        } as any),
      ).rejects.toMatchObject({ message: 'Already checked in today' });
    });

    it('T3 - throws when attendance not open yet (before open time)', async () => {
      dateUtils.nowMinutesJakarta.mockImplementation(() => 6 * 60); // 06:00
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });
      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });

      mockTransaction(async (tx) => {
        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase },
        });
        tx.employeeAttendance.findFirst.mockResolvedValue(null);
      });

      await expect(
        service.checkInFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
        } as any),
      ).rejects.toMatchObject({
        message: 'Attendance is not open yet at this time',
      });
    });

    it('T4 - throws when attendance already closed (after close time)', async () => {
      dateUtils.nowMinutesJakarta.mockImplementation(() => 23 * 60 + 30); // 23:30
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });
      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });

      mockTransaction(async (tx) => {
        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase },
        });
        tx.employeeAttendance.findFirst.mockResolvedValue(null);
      });

      await expect(
        service.checkInFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
        } as any),
      ).rejects.toMatchObject({ message: 'Attendance is already closed' });
    });

    it('T5 - throws when gesture payload sent but company recognize_with_gesture OFF', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });

      mockTransaction(async (tx) => {
        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase, recognize_with_gesture: false },
        });
      });

      await expect(
        service.checkInFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
          gesture: ['Smile'],
          hand: ['Left'],
        } as any),
      ).rejects.toMatchObject({
        message: 'Gesture recognition is disabled by company setting',
      });
    });

    it('T6 - allows company recognize_with_gesture ON but payload omitted (optional) even if plan < 1', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });
      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });

      mockTransaction(async (tx) => {
        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase, recognize_with_gesture: true },
        });

        tx.employeeAttendance.findFirst.mockResolvedValue(null);
        tx.employeeAttendance.create.mockResolvedValue({
          employee_attendance_id: 'a1',
        });
        tx.employeeAttendance.findUnique.mockResolvedValue({
          employee_attendance_id: 'a1',
        });
      });

      const res = await service.checkInFace(
        { buffer: Buffer.from('x') } as any,
        'e1',
        { latitude: '1', longitude: '2' } as any,
      );

      expect(res).toMatchObject({ employee_attendance_id: 'a1' });
    });

    it('T7 - throws when company recognize_with_gesture ON, payload sent, but plan level < 1', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });

      mockTransaction(async (tx) => {
        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase, recognize_with_gesture: true },
        });
      });

      await expect(
        service.checkInFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
          gesture: ['Smile'],
          hand: ['Left'],
        } as any),
      ).rejects.toMatchObject({
        message:
          'Gesture recognition requires subscription plan Level 1 or above',
      });
    });

    it('T8 - plan level 1 rejects if payload has 2 hands', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 1,
      });

      mockTransaction(async (tx) => {
        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase, recognize_with_gesture: true },
        });
      });

      await expect(
        service.checkInFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
          gesture: ['Smile', 'Smile'],
          hand: ['Left', 'Right'],
        } as any),
      ).rejects.toMatchObject({
        message: 'Your plan allows up to 1 hand gesture(s)',
      });
    });

    it('T9 - plan level 2 allows 2 hands (different) and succeeds when detected matches', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 2,
      });

      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [
          { hand: 'Left', gesture: 'Smile' },
          { hand: 'Right', gesture: 'Smile' },
        ],
      });

      mockTransaction(async (tx) => {
        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase, recognize_with_gesture: true },
        });

        tx.employeeAttendance.findFirst.mockResolvedValue(null);
        tx.employeeAttendance.create.mockResolvedValue({
          employee_attendance_id: 'a1',
        });
        tx.employeeAttendance.findUnique.mockResolvedValue({
          employee_attendance_id: 'a1',
        });
      });

      const res = await service.checkInFace(
        { buffer: Buffer.from('x') } as any,
        'e1',
        {
          latitude: '1',
          longitude: '2',
          gesture: ['Smile', 'Smile'],
          hand: ['Left', 'Right'],
        } as any,
      );

      expect(res).toMatchObject({ employee_attendance_id: 'a1' });
    });

    it('T10 - plan level 2 rejects 2 hands if same side', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 2,
      });

      mockTransaction(async (tx) => {
        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase, recognize_with_gesture: true },
        });
      });

      await expect(
        service.checkInFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
          gesture: ['Smile', 'Smile'],
          hand: ['Left', 'Left'],
        } as any),
      ).rejects.toMatchObject({
        message: 'When sending 2 hands, they must be different',
      });
    });

    it('T11 - throws when gesture expected but detected mismatch', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 1,
      });

      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [{ hand: 'Left', gesture: 'Wave' }],
      });

      mockTransaction(async (tx) => {
        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase, recognize_with_gesture: true },
        });
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

    it('T12 - enforces location radius when enabled and company has no location configured', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });
      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });

      mockTransaction(async (tx) => {
        tx.employee.findUnique.mockResolvedValue({
          company: {
            ...companyBase,
            attendance_location_enabled: true,
            attendance_radius_meters: 50,
          },
        });

        tx.$queryRaw.mockResolvedValue([
          { has_location: false, in_radius: false },
        ]);
      });

      await expect(
        service.checkInFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
        } as any),
      ).rejects.toMatchObject({
        message: 'Attendance location not configured',
      });
    });

    it('T13 - enforces location radius when enabled and outside radius', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });
      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });

      mockTransaction(async (tx) => {
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
      });

      await expect(
        service.checkInFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
        } as any),
      ).rejects.toMatchObject({
        message: 'You are outside the attendance radius',
      });
    });

    it('T14 - throws when attendance location enabled but radius is null', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });
      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });

      mockTransaction(async (tx) => {
        tx.employee.findUnique.mockResolvedValue({
          company: {
            ...companyBase,
            attendance_location_enabled: true,
            attendance_radius_meters: null,
          },
        });
      });

      await expect(
        service.checkInFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
        } as any),
      ).rejects.toMatchObject({ message: 'Attendance radius not configured' });
    });

    it('T15 - sets is_late=false and late_minutes=0 when within tolerance', async () => {
      jest.setSystemTime(new Date('2026-01-01T08:05:00.000Z'));
      dateUtils.nowMinutesJakarta.mockImplementation(() => 8 * 60 + 5);

      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });
      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });

      mockTransaction(async (tx) => {
        tx.employee.findUnique.mockResolvedValue({
          company: {
            ...companyBase,
            work_start_time: new Date('1970-01-01T08:00:00.000Z'),
            attendance_tolerance_minutes: 10,
          },
        });

        tx.employeeAttendance.findFirst.mockResolvedValue(null);

        tx.employeeAttendance.create.mockImplementation(({ data }) => {
          expect(data.is_late).toBe(false);
          expect(data.late_minutes).toBe(0);
          return { employee_attendance_id: 'a1' } as any;
        });

        tx.employeeAttendance.findUnique.mockResolvedValue({
          employee_attendance_id: 'a1',
        });
      });

      await service.checkInFace({ buffer: Buffer.from('x') } as any, 'e1', {
        latitude: '1',
        longitude: '2',
      } as any);
    });

    it('T16 - calculates late_minutes correctly when beyond tolerance', async () => {
      jest.setSystemTime(new Date('2026-01-01T08:25:00.000Z'));
      dateUtils.nowMinutesJakarta.mockImplementation(() => 8 * 60 + 25);

      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });
      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });

      mockTransaction(async (tx) => {
        tx.employee.findUnique.mockResolvedValue({
          company: {
            ...companyBase,
            work_start_time: new Date('1970-01-01T08:00:00.000Z'),
            attendance_tolerance_minutes: 10,
          },
        });

        tx.employeeAttendance.findFirst.mockResolvedValue(null);

        tx.employeeAttendance.create.mockImplementation(({ data }) => {
          expect(data.is_late).toBe(true);
          expect(data.late_minutes).toBe(15);
          return { employee_attendance_id: 'a1' } as any;
        });

        tx.employeeAttendance.findUnique.mockResolvedValue({
          employee_attendance_id: 'a1',
        });
      });

      await service.checkInFace({ buffer: Buffer.from('x') } as any, 'e1', {
        latitude: '1',
        longitude: '2',
      } as any);
    });

    it('T17 - throws when hand is not Left/Right (invalid hand value)', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 2,
      });

      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [{ hand: 'Left', gesture: 'Smile' }],
      });

      mockTransaction(async (tx) => {
        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase, recognize_with_gesture: true },
        });
      });

      await expect(
        service.checkInFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
          gesture: ['Smile'],
          hand: ['Kanan'],
        } as any),
      ).rejects.toMatchObject({ message: 'hand must be Left or Right' });
    });

    it('T18 - throws when hand and gesture length mismatch', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 2,
      });

      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [
          { hand: 'Left', gesture: 'Smile' },
          { hand: 'Right', gesture: 'Smile' },
        ],
      });

      mockTransaction(async (tx) => {
        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase, recognize_with_gesture: true },
        });
      });

      await expect(
        service.checkInFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
          gesture: ['Smile', 'Smile'],
          hand: ['Left'],
        } as any),
      ).rejects.toMatchObject({
        message: 'hand and gesture must have the same length',
      });
    });

    it('T19 - creates attendance when location enabled and employee is inside radius', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });
      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });

      mockTransaction(async (tx) => {
        tx.employee.findUnique.mockResolvedValue({
          company: {
            ...companyBase,
            attendance_location_enabled: true,
            attendance_radius_meters: 50,
          },
        });

        tx.$queryRaw.mockResolvedValue([
          { has_location: true, in_radius: true },
        ]);

        tx.employeeAttendance.findFirst.mockResolvedValue(null);

        tx.employeeAttendance.create.mockResolvedValue({
          employee_attendance_id: 'a1',
        });

        tx.employeeAttendance.findUnique.mockResolvedValue({
          employee_attendance_id: 'a1',
          employee_id: 'e1',
        });
      });

      const res = await service.checkInFace(
        { buffer: Buffer.from('x') } as any,
        'e1',
        { latitude: '1', longitude: '2' } as any,
      );

      expect(res).toMatchObject({
        employee_attendance_id: 'a1',
        employee_id: 'e1',
      });
    });

    it('T20 - creates attendance + saves check_in_location + creates attendance log when in radius', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });
      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });

      mockTransaction(async (tx) => {
        tx.employee.findUnique.mockResolvedValue({
          company: {
            ...companyBase,
            attendance_location_enabled: true,
            attendance_radius_meters: 50,
          },
        });

        tx.$queryRaw.mockResolvedValue([
          { has_location: true, in_radius: true },
        ]);

        tx.employeeAttendance.findFirst.mockResolvedValue(null);

        tx.employeeAttendance.create.mockResolvedValue({
          employee_attendance_id: 'a1',
        });

        tx.employeeAttendance.findUnique.mockResolvedValue({
          employee_attendance_id: 'a1',
          employee_id: 'e1',
        });

        tx.$executeRawUnsafe.mockImplementation(async (sql: string) => {
          expect(sql).toContain('check_in_location');
          return {} as any;
        });

        tx.attendanceLog.create.mockImplementation(async ({ data }) => {
          expect(data).toMatchObject({ employee_id: 'e1', log_type: 0 });
          return {} as any;
        });
      });

      const res = await service.checkInFace(
        { buffer: Buffer.from('x') } as any,
        'e1',
        { latitude: '1', longitude: '2' } as any,
      );

      expect(res).toMatchObject({
        employee_attendance_id: 'a1',
        employee_id: 'e1',
      });
    });
  });

  describe('checkOutFace', () => {
    it('throws when no open attendance (not checked in)', async () => {
      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });

      mockTransaction(async (tx) => {
        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase },
        });

        tx.employeeAttendance.findFirst.mockResolvedValue(null);
      });

      await expect(
        service.checkOutFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
        } as any),
      ).rejects.toMatchObject({ message: 'You have not checked in today' });
    });

    it('throws when existing status is not PRESENT', async () => {
      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });

      mockTransaction(async (tx) => {
        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase },
        });

        tx.employeeAttendance.findFirst.mockResolvedValue({
          employee_attendance_id: 'a1',
          check_in_time: new Date('2026-01-01T08:00:00.000Z'),
          is_late: false,
          status: 'SICK',
        });
      });

      await expect(
        service.checkOutFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates check_out_time when valid and logs', async () => {
      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });

      mockTransaction(async (tx) => {
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
      });

      const res = await service.checkOutFace(
        { buffer: Buffer.from('x') } as any,
        'e1',
        { latitude: '1', longitude: '2' } as any,
      );

      expect(res).toMatchObject({ employee_attendance_id: 'a1' });
    });

    it('enforces minimum work hours', async () => {
      faceRecognitionService.verifyFace.mockResolvedValue({
        gestures_detected: [],
      });
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
      });

      mockTransaction(async (tx) => {
        tx.employee.findUnique.mockResolvedValue({
          company: { ...companyBase, minimum_hours_per_day: 10 },
        });

        tx.employeeAttendance.findFirst.mockResolvedValue({
          employee_attendance_id: 'a1',
          check_in_time: new Date('2026-01-01T08:00:00.000Z'),
          is_late: true,
          status: 'PRESENT',
        });
      });

      await expect(
        service.checkOutFace({ buffer: Buffer.from('x') } as any, 'e1', {
          latitude: '1',
          longitude: '2',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ===================== EMPLOYEE QUERIES =====================

  describe('getAllAttendance', () => {
    it('returns list ordered by attendance_date desc', async () => {
      prisma.employeeAttendance.findMany.mockResolvedValue([
        { id: 1 },
        { id: 2 },
      ]);

      const res = await service.getAllAttendance('e1');

      expect(prisma.employeeAttendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { employee_id: 'e1', deleted_at: null },
          orderBy: { attendance_date: 'desc' },
        }),
      );
      expect(res).toEqual([{ id: 1 }, { id: 2 }]);
    });
  });

  describe('getTodayAttendanceStatus', () => {
    it('returns today attendance (or null)', async () => {
      prisma.employeeAttendance.findFirst.mockResolvedValue({
        employee_attendance_id: 'a1',
      });

      const res = await service.getTodayAttendanceStatus('e1');

      expect(prisma.employeeAttendance.findFirst).toHaveBeenCalled();
      expect(res).toEqual({ employee_attendance_id: 'a1' });
    });
  });

  describe('canEmployeeCheckIn', () => {
    it('returns false when already checked in today', async () => {
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

    it('returns false when before open time', async () => {
      dateUtils.nowMinutesJakarta.mockImplementation(() => 6 * 60);

      employeeService.getEmployeeByIdIncludeCompany.mockResolvedValue({
        employee_id: 'e1',
        company: { ...companyBase },
      });

      prisma.employeeAttendance.findFirst.mockResolvedValue(null);

      const res = await service.canEmployeeCheckIn('e1');

      expect(res.can_check_in).toBe(false);
      expect(res.reason).toBe('Attendance is not open yet at this time');
    });

    it('returns false when after close time', async () => {
      dateUtils.nowMinutesJakarta.mockImplementation(() => 23 * 60 + 30);

      employeeService.getEmployeeByIdIncludeCompany.mockResolvedValue({
        employee_id: 'e1',
        company: { ...companyBase },
      });

      prisma.employeeAttendance.findFirst.mockResolvedValue(null);

      const res = await service.canEmployeeCheckIn('e1');

      expect(res.can_check_in).toBe(false);
      expect(res.reason).toBe('Attendance is already closed');
    });

    it('returns true when within window and no attendance yet', async () => {
      // default 08:00 already set by beforeEach
      employeeService.getEmployeeByIdIncludeCompany.mockResolvedValue({
        employee_id: 'e1',
        company: { ...companyBase },
      });

      prisma.employeeAttendance.findFirst.mockResolvedValue(null);

      const res = await service.canEmployeeCheckIn('e1');

      expect(res.can_check_in).toBe(true);
      expect(res.reason).toBeNull();
      expect(res.opened_time).toBe(companyBase.attendance_open_time);
      expect(res.closed_time).toBe(companyBase.attendance_close_time);
    });

    it('throws when employee not found', async () => {
      employeeService.getEmployeeByIdIncludeCompany.mockResolvedValue(null);

      await expect(service.canEmployeeCheckIn('e1')).rejects.toMatchObject({
        message: 'Employee not found',
      });
    });
  });

  describe('canEmployeeCheckOut', () => {
    it('returns false when not checked in today', async () => {
      employeeService.getEmployeeByIdIncludeCompany.mockResolvedValue({
        employee_id: 'e1',
        company: { ...companyBase, minimum_hours_per_day: 8 },
      });

      prisma.employeeAttendance.findFirst.mockResolvedValue(null);

      const res = await service.canEmployeeCheckOut('e1');

      expect(res.can_check_out).toBe(false);
      expect(res.reason).toBe('Not checked in today');
    });

    it('returns false when already checked out', async () => {
      employeeService.getEmployeeByIdIncludeCompany.mockResolvedValue({
        employee_id: 'e1',
        company: { ...companyBase, minimum_hours_per_day: 8 },
      });

      prisma.employeeAttendance.findFirst.mockResolvedValue({
        check_in_time: new Date('2026-01-01T08:00:00.000Z'),
        check_out_time: new Date('2026-01-01T10:00:00.000Z'),
        total_work_hours: 2,
        is_late: true,
      });

      const res = await service.canEmployeeCheckOut('e1');

      expect(res.can_check_out).toBe(false);
      expect(res.reason).toBe('Already checked out today');
    });
  });
});
