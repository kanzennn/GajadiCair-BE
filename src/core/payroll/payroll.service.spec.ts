/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

// payroll.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PayrollService } from './payroll.service';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { CompanyService } from '../company/company.service';
import { EmployeeService } from '../employee/employee.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

describe('PayrollService', () => {
  let service: PayrollService;

  // ======= Mocks =======
  const prisma = {
    employee: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    payrollAllowanceRule: {
      findMany: jest.fn(),
    },
    payrollDeductionRule: {
      findMany: jest.fn(),
    },
    payrollLog: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const companyService = {
    getCompanyById: jest.fn(),
  };

  const employeeService = {
    getEmployeeById: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollService,
        { provide: PrismaService, useValue: prisma },
        { provide: CompanyService, useValue: companyService },
        { provide: EmployeeService, useValue: employeeService },
      ],
    }).compile();

    service = module.get(PayrollService);

    // make period deterministic
    (service as any).getCurrentPeriod = jest.fn(() => ({
      start: new Date('2025-12-01T00:00:00.000Z'),
      end: new Date('2025-12-29T23:59:59.999Z'),
    }));
  });

  describe('getCompanyPayrollSummary', () => {
    it('should return payroll summary with allowance + deduction calculations', async () => {
      prisma.employee.findMany.mockResolvedValue([
        {
          employee_id: 'e1',
          name: 'Emp 1',
          email: 'e1@mail.com',
          base_salary: 10_000,
          attendances: [
            { status: 'ABSENT', late_minutes: 0 },
            { status: 'LATE', late_minutes: 20 }, // note: status can be PRESENT in your schema; we only use late_minutes
            { status: 'PRESENT', late_minutes: 30 },
          ],
        },
      ]);

      prisma.payrollAllowanceRule.findMany.mockResolvedValue([
        { name: 'Transport', fixed_amount: 1000, percentage: null },
        { name: 'Bonus', fixed_amount: null, percentage: 10 }, // 10% of base (1000)
      ]);

      prisma.payrollDeductionRule.findMany.mockResolvedValue([
        // ABSENT: 5% of base per day => 500 per day; absentDays=1 => 500
        {
          name: 'Absent Deduction',
          type: 'ABSENT',
          fixed_amount: null,
          percentage: 5,
          per_minute: false,
          max_minutes: null,
        },
        // LATE: per_minute true, fixed_amount=10, max_minutes=40
        // lateMinutes=20+30=50 -> capped to 40 -> 40*10=400
        {
          name: 'Late Deduction',
          type: 'LATE',
          fixed_amount: 10,
          percentage: null,
          per_minute: true,
          max_minutes: 40,
        },
      ]);

      const res = await service.getCompanyPayrollSummary('c1');

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            company_id: 'c1',
            deleted_at: null,
          }),
        }),
      );

      expect(prisma.payrollAllowanceRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            company_id: 'c1',
            is_active: true,
            deleted_at: null,
          }),
        }),
      );

      expect(prisma.payrollDeductionRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            company_id: 'c1',
            is_active: true,
            deleted_at: null,
          }),
        }),
      );

      expect(res).toHaveLength(1);

      const row = res[0];
      expect(row.employee_id).toBe('e1');
      expect(row.base_salary).toBe(10_000);

      // allowance: 1000 + 1000 = 2000
      expect(row.allowance.total).toBe(2000);
      expect(row.allowance.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Transport', amount: 1000 }),
          expect.objectContaining({ name: 'Bonus', amount: 1000 }),
        ]),
      );

      // attendance
      expect(row.attendance.absent_days).toBe(1);
      expect(row.attendance.late_minutes).toBe(50);

      // deduction: absent 500 + late 400 = 900
      expect(row.deduction.total).toBe(900);
      expect(row.deduction.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Absent Deduction',
            type: 'ABSENT',
            amount: 500,
          }),
          expect.objectContaining({
            name: 'Late Deduction',
            type: 'LATE',
            amount: 400,
          }),
        ]),
      );

      // take home: 10000 + 2000 - 900 = 11100
      expect(row.take_home_pay).toBe(11_100);
    });

    it('should filter by employeeId when provided', async () => {
      prisma.employee.findMany.mockResolvedValue([]);
      prisma.payrollAllowanceRule.findMany.mockResolvedValue([]);
      prisma.payrollDeductionRule.findMany.mockResolvedValue([]);

      await service.getCompanyPayrollSummary('c1', 'e1');

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            company_id: 'c1',
            employee_id: 'e1',
            deleted_at: null,
          }),
        }),
      );
    });
  });

  describe('getEmployeePayroll', () => {
    it('should throw when employee not found', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.getEmployeePayroll('e1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should return first payroll result of that employee', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        employee_id: 'e1',
        company_id: 'c1',
      });

      prisma.employee.findMany.mockResolvedValue([
        {
          employee_id: 'e1',
          name: 'Emp',
          email: 'e@mail.com',
          base_salary: 1000,
          attendances: [],
        },
      ]);
      prisma.payrollAllowanceRule.findMany.mockResolvedValue([]);
      prisma.payrollDeductionRule.findMany.mockResolvedValue([]);

      const res = await service.getEmployeePayroll('e1');

      expect(prisma.employee.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { employee_id: 'e1', deleted_at: null },
          select: { employee_id: true, company_id: true },
        }),
      );

      expect(res).toEqual(
        expect.objectContaining({
          employee_id: 'e1',
          base_salary: 1000,
          take_home_pay: 1000,
        }),
      );
    });

    it('should return null if payroll summary returns empty', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        employee_id: 'e1',
        company_id: 'c1',
      });

      prisma.employee.findMany.mockResolvedValue([]);
      prisma.payrollAllowanceRule.findMany.mockResolvedValue([]);
      prisma.payrollDeductionRule.findMany.mockResolvedValue([]);

      const res = await service.getEmployeePayroll('e1');
      expect(res).toBeNull();
    });
  });

  describe('getAllPayrollLogByCompany', () => {
    it('should throw when company not found', async () => {
      companyService.getCompanyById.mockResolvedValue(null);

      await expect(
        service.getAllPayrollLogByCompany('c1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should return logs when company exists', async () => {
      companyService.getCompanyById.mockResolvedValue({ company_id: 'c1' });

      prisma.payrollLog.findMany.mockResolvedValue([
        { payroll_log_id: 'p1' },
        { payroll_log_id: 'p2' },
      ]);

      const res = await service.getAllPayrollLogByCompany('c1');

      expect(prisma.payrollLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deleted_at: null,
            employee: expect.objectContaining({
              company_id: 'c1',
              deleted_at: null,
            }),
          }),
          include: expect.any(Object),
          orderBy: { payroll_date: 'desc' },
        }),
      );

      expect(res).toHaveLength(2);
    });
  });

  describe('getAllPayrollLogByEmployee', () => {
    it('should throw when employee not found', async () => {
      employeeService.getEmployeeById.mockResolvedValue(null);

      await expect(
        service.getAllPayrollLogByEmployee('e1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should return logs when employee exists', async () => {
      employeeService.getEmployeeById.mockResolvedValue({ employee_id: 'e1' });

      prisma.payrollLog.findMany.mockResolvedValue([{ payroll_log_id: 'p1' }]);

      const res = await service.getAllPayrollLogByEmployee('e1');

      expect(prisma.payrollLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { employee_id: 'e1', deleted_at: null },
          include: expect.any(Object),
          orderBy: { payroll_date: 'desc' },
        }),
      );

      expect(res).toHaveLength(1);
    });
  });

  describe('getOnePayrollLog', () => {
    it('should throw when payroll log not found', async () => {
      prisma.payrollLog.findFirst.mockResolvedValue(null);

      await expect(service.getOnePayrollLog('p1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should return payroll log when found', async () => {
      prisma.payrollLog.findFirst.mockResolvedValue({
        payroll_log_id: 'p1',
        employee: { employee_id: 'e1' },
        payroll_details: [],
      });

      const res = await service.getOnePayrollLog('p1');

      expect(prisma.payrollLog.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { payroll_log_id: 'p1', deleted_at: null },
          include: expect.any(Object),
        }),
      );

      expect(res).toEqual(
        expect.objectContaining({
          payroll_log_id: 'p1',
        }),
      );
    });
  });
});
