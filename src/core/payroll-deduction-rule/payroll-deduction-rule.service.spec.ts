// payroll-deduction-rule.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';

import { PayrollDeductionRuleService } from './payroll-deduction-rule.service';

import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

import { PayrollDeductionType } from 'generated/prisma';

describe('PayrollDeductionRuleService', () => {
  let service: PayrollDeductionRuleService;

  // ======= Mocks =======
  const prisma = {
    payrollDeductionRule: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollDeductionRuleService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(PayrollDeductionRuleService);
  });

  describe('create', () => {
    it('should throw when percentage and fixed_amount are both provided', async () => {
      await expect(
        service.create('c1', {
          name: 'Rule',
          type: PayrollDeductionType.LATE,
          percentage: 10,
          fixed_amount: 5000,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.payrollDeductionRule.create).not.toHaveBeenCalled();
    });

    it('should throw when type ABSENT uses per_minute', async () => {
      await expect(
        service.create('c1', {
          name: 'Rule',
          type: PayrollDeductionType.ABSENT,
          per_minute: true,
          percentage: 10,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.payrollDeductionRule.create).not.toHaveBeenCalled();
    });

    it('should create rule with defaults (per_minute=false, is_active=true)', async () => {
      prisma.payrollDeductionRule.create.mockResolvedValue({ id: 'r1' });

      const dto: any = {
        name: 'Late Deduction',
        type: PayrollDeductionType.LATE,
        percentage: 5,
      };

      const res = await service.create('c1', dto);

      expect(prisma.payrollDeductionRule.create).toHaveBeenCalledWith({
        data: {
          company_id: 'c1',
          name: 'Late Deduction',
          type: PayrollDeductionType.LATE,
          percentage: 5,
          fixed_amount: undefined,
          per_minute: false,
          max_minutes: undefined,
          is_active: true,
        },
      });

      expect(res).toEqual({ id: 'r1' });
    });

    it('should create rule when fixed_amount is used', async () => {
      prisma.payrollDeductionRule.create.mockResolvedValue({ id: 'r2' });

      const dto: any = {
        name: 'Absent Deduction',
        type: PayrollDeductionType.ABSENT,
        fixed_amount: 100000,
        is_active: false,
      };

      const res = await service.create('c1', dto);

      expect(prisma.payrollDeductionRule.create).toHaveBeenCalledWith({
        data: {
          company_id: 'c1',
          name: 'Absent Deduction',
          type: PayrollDeductionType.ABSENT,
          percentage: undefined,
          fixed_amount: 100000,
          per_minute: false,
          max_minutes: undefined,
          is_active: false,
        },
      });

      expect(res).toEqual({ id: 'r2' });
    });
  });

  describe('findAllByCompany', () => {
    it('should return rules ordered by created_at desc', async () => {
      prisma.payrollDeductionRule.findMany.mockResolvedValue([{ id: 'r1' }]);

      const res = await service.findAllByCompany('c1');

      expect(prisma.payrollDeductionRule.findMany).toHaveBeenCalledWith({
        where: { company_id: 'c1', deleted_at: null },
        orderBy: { created_at: 'desc' },
      });

      expect(res).toEqual([{ id: 'r1' }]);
    });
  });

  describe('findOneByCompany', () => {
    it('should throw when rule not found', async () => {
      prisma.payrollDeductionRule.findFirst.mockResolvedValue(null);

      await expect(service.findOneByCompany('c1', 'r1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should return rule when found', async () => {
      prisma.payrollDeductionRule.findFirst.mockResolvedValue({ id: 'r1' });

      const res = await service.findOneByCompany('c1', 'r1');

      expect(prisma.payrollDeductionRule.findFirst).toHaveBeenCalledWith({
        where: {
          payroll_deduction_rule_id: 'r1',
          company_id: 'c1',
          deleted_at: null,
        },
      });

      expect(res).toEqual({ id: 'r1' });
    });
  });

  describe('update', () => {
    it('should throw when rule not found (via findOneByCompany)', async () => {
      prisma.payrollDeductionRule.findFirst.mockResolvedValue(null);

      await expect(
        service.update('c1', 'r1', { name: 'New' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.payrollDeductionRule.update).not.toHaveBeenCalled();
    });

    it('should throw when percentage and fixed_amount are both provided', async () => {
      prisma.payrollDeductionRule.findFirst.mockResolvedValue({ id: 'r1' });

      await expect(
        service.update('c1', 'r1', {
          percentage: 1,
          fixed_amount: 1000,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.payrollDeductionRule.update).not.toHaveBeenCalled();
    });

    it('should update rule when valid', async () => {
      prisma.payrollDeductionRule.findFirst.mockResolvedValue({ id: 'r1' });
      prisma.payrollDeductionRule.update.mockResolvedValue({ id: 'r1' });

      const dto: any = {
        name: 'Updated',
        type: PayrollDeductionType.LATE,
        per_minute: true,
        max_minutes: 60,
        percentage: 2,
        is_active: true,
      };

      const res = await service.update('c1', 'r1', dto);

      expect(prisma.payrollDeductionRule.update).toHaveBeenCalledWith({
        where: { payroll_deduction_rule_id: 'r1' },
        data: {
          name: 'Updated',
          type: PayrollDeductionType.LATE,
          percentage: 2,
          fixed_amount: undefined,
          per_minute: true,
          max_minutes: 60,
          is_active: true,
        },
      });

      expect(res).toEqual({ id: 'r1' });
    });
  });

  describe('remove', () => {
    it('should throw when rule not found', async () => {
      prisma.payrollDeductionRule.findFirst.mockResolvedValue(null);

      await expect(service.remove('c1', 'r1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should soft delete rule (set deleted_at)', async () => {
      prisma.payrollDeductionRule.findFirst.mockResolvedValue({ id: 'r1' });
      prisma.payrollDeductionRule.update.mockResolvedValue({ id: 'r1' });

      const res = await service.remove('c1', 'r1');

      expect(prisma.payrollDeductionRule.update).toHaveBeenCalledWith({
        where: { payroll_deduction_rule_id: 'r1' },
        data: { deleted_at: expect.any(Date) },
      });

      expect(res).toEqual({ id: 'r1' });
    });
  });
});
