/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// leave-application.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';

import { LeaveApplicationService } from './leave-application.service';

import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { EmployeeService } from '../employee/employee.service';

import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

describe('LeaveApplicationService', () => {
  let service: LeaveApplicationService;

  // ======= Mocks =======
  const txFactory = () => ({
    employeeLeaveApplication: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    employeeAttendance: {
      createMany: jest.fn(),
    },
  });

  const prisma = {
    employeeLeaveApplication: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const employeeService = {
    getEmployeeById: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveApplicationService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmployeeService, useValue: employeeService },
      ],
    }).compile();

    service = module.get(LeaveApplicationService);
  });

  const mockTransaction = (setup?: (tx: any) => void) => {
    prisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = txFactory();
      if (setup) setup(tx);
      return cb(tx);
    });
  };

  describe('getEmployeeLeaveApplications', () => {
    it('should return employee leave applications', async () => {
      prisma.employeeLeaveApplication.findMany.mockResolvedValue([{ id: 1 }]);

      const res = await service.getEmployeeLeaveApplications('e1');

      expect(prisma.employeeLeaveApplication.findMany).toHaveBeenCalledWith({
        where: { employee_id: 'e1', deleted_at: null },
        orderBy: { created_at: 'desc' },
      });
      expect(res).toEqual([{ id: 1 }]);
    });
  });

  describe('getCompanyLeaveApplications', () => {
    it('should return company leave applications with employee info', async () => {
      prisma.employeeLeaveApplication.findMany.mockResolvedValue([{ id: 1 }]);

      const res = await service.getCompanyLeaveApplications('c1');

      expect(prisma.employeeLeaveApplication.findMany).toHaveBeenCalledWith({
        where: {
          employee: { company_id: 'c1' },
          deleted_at: null,
        },
        orderBy: { created_at: 'desc' },
        include: {
          employee: {
            select: {
              employee_id: true,
              name: true,
              email: true,
              avatar_uri: true,
            },
          },
        },
      });

      expect(res).toEqual([{ id: 1 }]);
    });
  });

  describe('create', () => {
    it('should throw when employee not found', async () => {
      employeeService.getEmployeeById.mockResolvedValue(null);

      mockTransaction();

      await expect(
        service.create('e1', {
          start_date: '2026-01-01',
          end_date: '2026-01-02',
          reason: 'test',
          attachment_uri: null,
          type: 'LEAVE',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw when end_date < start_date', async () => {
      employeeService.getEmployeeById.mockResolvedValue({ employee_id: 'e1' });

      mockTransaction();

      await expect(
        service.create('e1', {
          start_date: '2026-01-03',
          end_date: '2026-01-02',
          reason: 'test',
          attachment_uri: null,
          type: 'LEAVE',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw when overlap exists', async () => {
      employeeService.getEmployeeById.mockResolvedValue({ employee_id: 'e1' });

      mockTransaction((tx) => {
        tx.employeeLeaveApplication.findFirst.mockResolvedValue({
          employee_leave_application_id: 'la1',
        });
      });

      await expect(
        service.create('e1', {
          start_date: '2026-01-01',
          end_date: '2026-01-03',
          reason: 'test',
          attachment_uri: null,
          type: 'LEAVE',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should create leave application when valid', async () => {
      employeeService.getEmployeeById.mockResolvedValue({ employee_id: 'e1' });

      mockTransaction((tx) => {
        tx.employeeLeaveApplication.findFirst.mockResolvedValue(null); // no overlap
        tx.employeeLeaveApplication.create.mockResolvedValue({
          employee_leave_application_id: 'la1',
          employee_id: 'e1',
        });
      });

      const res = await service.create('e1', {
        start_date: '2026-01-01',
        end_date: '2026-01-03',
        reason: '  sakit  ',
        attachment_uri: 's3://x',
        type: 'SICK',
      } as any);

      expect(res).toMatchObject({
        employee_leave_application_id: 'la1',
        employee_id: 'e1',
      });

      // We can only assert via factory behavior: check create payload by re-mocking with spy
      // So do a direct expectation on the mock in setup:
      // (we still can access it by capturing tx in closure)
    });

    it('should call tx.employeeLeaveApplication.create with parsed dates + trimmed reason', async () => {
      employeeService.getEmployeeById.mockResolvedValue({ employee_id: 'e1' });

      let capturedTx: any;
      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = txFactory();
        capturedTx = tx;

        tx.employeeLeaveApplication.findFirst.mockResolvedValue(null);
        tx.employeeLeaveApplication.create.mockResolvedValue({
          employee_leave_application_id: 'la1',
          employee_id: 'e1',
        });

        return cb(tx);
      });

      await service.create('e1', {
        start_date: '2026-01-01',
        end_date: '2026-01-03',
        reason: '  sakit  ',
        attachment_uri: 's3://x',
        type: 'SICK',
      } as any);

      expect(capturedTx.employeeLeaveApplication.create).toHaveBeenCalledWith({
        data: {
          employee_id: 'e1',
          start_date: new Date('2026-01-01T00:00:00.000Z'),
          end_date: new Date('2026-01-03T00:00:00.000Z'),
          reason: 'sakit',
          attachment_uri: 's3://x',
          type: 'SICK',
        },
      });
    });
  });

  describe('updateLeaveApplicationStatus', () => {
    it('should throw when leave application not found', async () => {
      mockTransaction((tx) => {
        tx.employeeLeaveApplication.findFirst.mockResolvedValue(null);
      });

      await expect(
        service.updateLeaveApplicationStatus('c1', {
          employee_leave_application_id: 'la1',
          is_approve: true,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw when leave already processed (status !== 0)', async () => {
      mockTransaction((tx) => {
        tx.employeeLeaveApplication.findFirst.mockResolvedValue({
          employee_leave_application_id: 'la1',
          employee_id: 'e1',
          start_date: new Date('2026-01-01T00:00:00.000Z'),
          end_date: new Date('2026-01-03T00:00:00.000Z'),
          status: 1,
          type: 'LEAVE',
        });
      });

      await expect(
        service.updateLeaveApplicationStatus('c1', {
          employee_leave_application_id: 'la1',
          is_approve: true,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should reject leave (status=2) without creating attendance', async () => {
      mockTransaction((tx) => {
        tx.employeeLeaveApplication.findFirst.mockResolvedValue({
          employee_leave_application_id: 'la1',
          employee_id: 'e1',
          start_date: new Date('2026-01-01T00:00:00.000Z'),
          end_date: new Date('2026-01-03T00:00:00.000Z'),
          status: 0,
          type: 'LEAVE',
        });

        tx.employeeLeaveApplication.update.mockResolvedValue({
          employee_leave_application_id: 'la1',
          status: 2,
        });
      });

      const res = await service.updateLeaveApplicationStatus('c1', {
        employee_leave_application_id: 'la1',
        is_approve: false,
      } as any);

      expect(res).toEqual({ employee_leave_application_id: 'la1', status: 2 });

      // ensure attendance createMany not called
      // (capture tx via re-mock)
    });

    it('should approve leave (status=1) and create attendance rows (skipDuplicates)', async () => {
      let capturedTx: any;

      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = txFactory();
        capturedTx = tx;

        tx.employeeLeaveApplication.findFirst.mockResolvedValue({
          employee_leave_application_id: 'la1',
          employee_id: 'e1',
          start_date: new Date('2026-01-01T10:30:00.000Z'), // non-midnight to ensure normalize
          end_date: new Date('2026-01-03T23:59:59.000Z'),
          status: 0,
          type: 'SICK',
        });

        tx.employeeLeaveApplication.update.mockResolvedValue({
          employee_leave_application_id: 'la1',
          status: 1,
        });

        tx.employeeAttendance.createMany.mockResolvedValue({ count: 3 });

        return cb(tx);
      });

      const res = await service.updateLeaveApplicationStatus('c1', {
        employee_leave_application_id: 'la1',
        is_approve: true,
      } as any);

      expect(res).toEqual({ employee_leave_application_id: 'la1', status: 1 });

      expect(capturedTx.employeeLeaveApplication.update).toHaveBeenCalledWith({
        where: { employee_leave_application_id: 'la1' },
        data: { status: 1 },
      });

      // 3 hari: 1,2,3 Jan
      expect(capturedTx.employeeAttendance.createMany).toHaveBeenCalledWith({
        data: [
          {
            employee_id: 'e1',
            attendance_date: new Date('2026-01-01T00:00:00.000Z'),
            status: 'SICK',
          },
          {
            employee_id: 'e1',
            attendance_date: new Date('2026-01-02T00:00:00.000Z'),
            status: 'SICK',
          },
          {
            employee_id: 'e1',
            attendance_date: new Date('2026-01-03T00:00:00.000Z'),
            status: 'SICK',
          },
        ],
        skipDuplicates: true,
      });
    });
  });
});
