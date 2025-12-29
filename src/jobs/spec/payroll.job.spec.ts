// payroll.job.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';

import { PayrollJobService } from '../payroll.job';

import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { PayrollService } from 'src/core/payroll/payroll.service';
import { CustomMailerService } from 'src/common/services/mailer/mailer.service';

import { PayrollDetailType } from 'generated/prisma';

describe('PayrollJobService', () => {
  let service: PayrollJobService;

  const prisma = {
    company: {
      findMany: jest.fn(),
    },
    payrollLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    payrollDetail: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const payrollService = {
    getCompanyPayrollSummary: jest.fn(),
  };

  const mailer = {
    sendTemplatedEmail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollJobService,
        { provide: PrismaService, useValue: prisma },
        { provide: PayrollService, useValue: payrollService },
        { provide: CustomMailerService, useValue: mailer },
      ],
    }).compile();

    service = module.get(PayrollJobService);

    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const freezeNow = (iso: string) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(iso));
  };

  const mockSummary = (over?: Partial<any>) => ({
    employee_id: 'e1',
    name: 'Emp One',
    email: 'e1@mail.com',
    period: {
      start: new Date('2025-12-01T00:00:00.000Z'),
      end: new Date('2025-12-29T23:59:59.999Z'),
    },
    base_salary: 5_000_000,
    attendance: { absent_days: 1, late_minutes: 10 },
    allowance: {
      total: 100_000,
      details: [{ name: 'Meal', amount: 100_000 }],
    },
    deduction: {
      total: 50_000,
      details: [{ name: 'Late', type: 'LATE', amount: 50_000 }],
    },
    take_home_pay: 5_050_000,
    ...over,
  });

  const setupTransactionMock = () => {
    // bikin prisma.$transaction eksekusi callback dan ngasih "tx"
    prisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        payrollLog: { create: prisma.payrollLog.create },
        payrollDetail: { createMany: prisma.payrollDetail.createMany },
      };
      return cb(tx);
    });
  };

  describe('runMonthlyPayroll', () => {
    it('should return early when no company scheduled today', async () => {
      freezeNow('2025-12-29T10:00:00.000Z'); // date = 29

      prisma.company.findMany.mockResolvedValue([]);

      await service.runMonthlyPayroll();

      expect(prisma.company.findMany).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          payroll_day_of_month: 29,
        },
        select: { company_id: true, name: true },
      });

      expect(payrollService.getCompanyPayrollSummary).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(mailer.sendTemplatedEmail).not.toHaveBeenCalled();
    });

    it('should process each company and create payroll + send email for each summary', async () => {
      freezeNow('2025-12-29T10:00:00.000Z'); // date=29

      prisma.company.findMany.mockResolvedValue([
        { company_id: 'c1', name: 'Company A' },
      ]);

      payrollService.getCompanyPayrollSummary.mockResolvedValue([
        mockSummary({ employee_id: 'e1', email: 'e1@mail.com' }),
        mockSummary({
          employee_id: 'e2',
          email: 'e2@mail.com',
          name: 'Emp Two',
        }),
      ]);

      // idempotent check: belum ada payroll
      prisma.payrollLog.findFirst.mockResolvedValue(null);

      // transaction create payroll log
      prisma.payrollLog.create.mockResolvedValue({ payroll_log_id: 'pl1' });
      prisma.payrollDetail.createMany.mockResolvedValue({ count: 3 });

      setupTransactionMock();

      mailer.sendTemplatedEmail.mockResolvedValue(true);

      await service.runMonthlyPayroll();

      // ambil summary
      expect(payrollService.getCompanyPayrollSummary).toHaveBeenCalledWith(
        'c1',
      );

      // idempotent check dipanggil 2x (e1,e2)
      expect(prisma.payrollLog.findFirst).toHaveBeenCalledTimes(2);

      // create payroll log + details 2x
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(prisma.payrollLog.create).toHaveBeenCalledTimes(2);
      expect(prisma.payrollDetail.createMany).toHaveBeenCalledTimes(2);

      // pastiin payload payroll detail minimal benar (base salary, allowance, deduction negative)
      const firstCreateManyArg =
        prisma.payrollDetail.createMany.mock.calls[0][0];
      expect(firstCreateManyArg.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            description: 'Base Salary',
            type: PayrollDetailType.BASE_SALARY,
            amount: 5_000_000,
          }),
          expect.objectContaining({
            description: 'Meal',
            type: PayrollDetailType.ALLOWANCE,
            amount: 100_000,
          }),
          expect.objectContaining({
            description: 'Late',
            type: PayrollDetailType.DEDUCTION,
            amount: -50_000,
          }),
        ]),
      );

      // email dikirim 2x
      expect(mailer.sendTemplatedEmail).toHaveBeenCalledTimes(2);
      expect(mailer.sendTemplatedEmail).toHaveBeenCalledWith(
        'e1@mail.com',
        expect.stringContaining('Slip Gaji'),
        'payroll-notification',
        expect.any(Object),
      );
    });

    it('should skip employee when payroll already exists in current period', async () => {
      freezeNow('2025-12-29T10:00:00.000Z');

      prisma.company.findMany.mockResolvedValue([
        { company_id: 'c1', name: 'Company A' },
      ]);

      payrollService.getCompanyPayrollSummary.mockResolvedValue([
        mockSummary({ employee_id: 'e1' }),
        mockSummary({ employee_id: 'e2' }),
      ]);

      // e1 sudah paid, e2 belum
      prisma.payrollLog.findFirst
        .mockResolvedValueOnce({ payroll_log_id: 'existing' })
        .mockResolvedValueOnce(null);

      prisma.payrollLog.create.mockResolvedValue({ payroll_log_id: 'pl2' });
      prisma.payrollDetail.createMany.mockResolvedValue({ count: 3 });
      setupTransactionMock();

      mailer.sendTemplatedEmail.mockResolvedValue(true);

      await service.runMonthlyPayroll();

      // e1 diskip => transaksi 1x untuk e2 saja
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mailer.sendTemplatedEmail).toHaveBeenCalledTimes(1);
    });

    it('should not fail the whole job when sending email throws', async () => {
      freezeNow('2025-12-29T10:00:00.000Z');

      prisma.company.findMany.mockResolvedValue([
        { company_id: 'c1', name: 'Company A' },
      ]);

      payrollService.getCompanyPayrollSummary.mockResolvedValue([
        mockSummary({ employee_id: 'e1', email: 'e1@mail.com' }),
        mockSummary({ employee_id: 'e2', email: 'e2@mail.com' }),
      ]);

      prisma.payrollLog.findFirst.mockResolvedValue(null);

      prisma.payrollLog.create.mockResolvedValue({ payroll_log_id: 'plx' });
      prisma.payrollDetail.createMany.mockResolvedValue({ count: 3 });
      setupTransactionMock();

      // email pertama fail, kedua sukses
      mailer.sendTemplatedEmail
        .mockRejectedValueOnce(new Error('SMTP down'))
        .mockResolvedValueOnce(true);

      await expect(service.runMonthlyPayroll()).resolves.toBeUndefined();

      // payroll tetap dibuat untuk keduanya (email fail tidak menggagalkan payroll)
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(mailer.sendTemplatedEmail).toHaveBeenCalledTimes(2);
    });

    it('should continue other companies when one company throws during processing', async () => {
      freezeNow('2025-12-29T10:00:00.000Z');

      prisma.company.findMany.mockResolvedValue([
        { company_id: 'c1', name: 'Company A' },
        { company_id: 'c2', name: 'Company B' },
      ]);

      // c1 melempar error
      payrollService.getCompanyPayrollSummary
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce([mockSummary({ employee_id: 'e2' })]);

      prisma.payrollLog.findFirst.mockResolvedValue(null);
      prisma.payrollLog.create.mockResolvedValue({ payroll_log_id: 'pl2' });
      prisma.payrollDetail.createMany.mockResolvedValue({ count: 3 });
      setupTransactionMock();
      mailer.sendTemplatedEmail.mockResolvedValue(true);

      await service.runMonthlyPayroll();

      // tetap memproses c2
      expect(payrollService.getCompanyPayrollSummary).toHaveBeenCalledWith(
        'c1',
      );
      expect(payrollService.getCompanyPayrollSummary).toHaveBeenCalledWith(
        'c2',
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1); // hanya untuk c2
      expect(mailer.sendTemplatedEmail).toHaveBeenCalledTimes(1);
    });
  });
});
