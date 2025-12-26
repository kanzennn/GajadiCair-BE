/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, mock } from 'bun:test';

import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import type { Prisma } from 'generated/prisma';

/**
 * IMPORTANT:
 * Path di mock.module harus SAMA PERSIS dengan path import di attendance.service.ts
 */

mock.module('../subscription/subscription.service', () => {
  class SubscriptionService {
    getSubscriptionStatus = mock(() => ({ level_plan: 0 }));
  }
  return { SubscriptionService };
});

mock.module('../company/company.service', () => {
  class CompanyService {
    getCompanyById = mock(() => ({ company_id: 'comp-1' }));
  }
  return { CompanyService };
});

mock.module('../employee/employee.service', () => {
  class EmployeeService {
    getEmployeeByIdIncludeCompany = mock(() => null);
  }
  return { EmployeeService };
});

mock.module('../face-recognition/face-recognition.service', () => {
  class FaceRecognitionService {
    verifyFace = mock(() => undefined);
  }
  return { FaceRecognitionService };
});

// import setelah mock.module
const { AttendanceService } = await import('./attendance.service');
const { SubscriptionService } = await import(
  '../subscription/subscription.service'
);
const { CompanyService } = await import('../company/company.service');
const { EmployeeService } = await import('../employee/employee.service');
const { FaceRecognitionService } = await import(
  '../face-recognition/face-recognition.service'
);

describe('AttendanceService', () => {
  let service: InstanceType<typeof AttendanceService>;

  // Provider mocks (akan di-recreate tiap beforeEach biar bersih)
  let prismaMock: PrismaService;
  let subscriptionServiceMock: InstanceType<typeof SubscriptionService>;
  let companyServiceMock: InstanceType<typeof CompanyService>;
  let employeeServiceMock: InstanceType<typeof EmployeeService>;
  let faceRecognitionServiceMock: InstanceType<typeof FaceRecognitionService>;

  function makeTx(): Prisma.TransactionClient {
    return {
      employee: {
        // default: employee not found
        findUnique: mock(async () => null),
      },
      employeeAttendance: {
        findFirst: mock(async () => null),
        create: mock(async () => ({ employee_attendance_id: 'att-1' })),
        findUnique: mock(async () => ({ employee_attendance_id: 'att-1' })),
        update: mock(async () => ({ employee_attendance_id: 'att-1' })),
      },
      attendanceLog: { create: mock(async () => null) },
      company: {
        update: mock(async () => null),
        findUnique: mock(async () => null),
      },
      $queryRaw: mock(async () => []),
      $executeRaw: mock(async () => null),
      $executeRawUnsafe: mock(async () => null),
    } as unknown as Prisma.TransactionClient;
  }

  function mockTransaction(tx: Prisma.TransactionClient) {
    (prismaMock as any).$transaction = mock(async (cb: any) => cb(tx));
  }

  beforeEach(async () => {
    // ✅ Jangan mock.restore() di sini (bisa merusak provider mock yang sudah dipakai Nest)

    subscriptionServiceMock = {
      getSubscriptionStatus: mock(() => ({ level_plan: 0 })),
    } as any;

    companyServiceMock = {
      getCompanyById: mock(() => ({ company_id: 'comp-1' })),
    } as any;

    employeeServiceMock = {
      getEmployeeByIdIncludeCompany: mock(() => null),
    } as any;

    faceRecognitionServiceMock = {
      verifyFace: mock(async () => undefined),
    } as any;

    prismaMock = {
      $transaction: mock(async (cb: any) => cb(makeTx())),
      employeeAttendance: {
        findMany: mock(async () => []),
        findFirst: mock(async () => null),
      },
      employee: {
        findUnique: mock(async () => null),
        findFirst: mock(async () => null),
      },
      company: {
        findUnique: mock(async () => null),
        update: mock(async () => null),
      },
      $queryRaw: mock(async () => []),
      $executeRaw: mock(async () => null),
      $executeRawUnsafe: mock(async () => null),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SubscriptionService, useValue: subscriptionServiceMock },
        { provide: CompanyService, useValue: companyServiceMock },
        { provide: EmployeeService, useValue: employeeServiceMock },
        {
          provide: FaceRecognitionService,
          useValue: faceRecognitionServiceMock,
        },
      ],
    }).compile();

    service = module.get(AttendanceService);
  });

  it('checkInFace: throws if verifyFace fails', async () => {
    faceRecognitionServiceMock.verifyFace = mock(async () => {
      throw new Error('face fail');
    }) as any;

    await expect(
      service.checkInFace({} as any, 'emp-1', {
        latitude: '1',
        longitude: '2',
      } as any),
    ).rejects.toThrow('face fail');
  });

  it('checkInFace: throws when employee not found', async () => {
    const tx = makeTx();
    mockTransaction(tx);

    // Bun mock -> set ulang functionnya (bukan .mockResolvedValue)
    (tx.employee as any).findUnique = mock(async () => null);

    await expect(
      service.checkInFace({} as any, 'emp-1', {
        latitude: '1',
        longitude: '2',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('getAllAttendance: returns histories', async () => {
    (prismaMock as any).employeeAttendance.findMany = mock(async () => [
      { employee_attendance_id: 'att-1' },
    ]);

    const res = await service.getAllAttendance('emp-1');

    expect(
      (prismaMock as any).employeeAttendance.findMany,
    ).toHaveBeenCalledWith({
      where: { employee_id: 'emp-1', deleted_at: null },
      orderBy: { attendance_date: 'desc' },
    });

    expect(res).toEqual([{ employee_attendance_id: 'att-1' }]);
  });
});
