// payroll-allowance-rule.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';

import { PayrollAllowanceRuleService } from './payroll-allowance-rule.service';

import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

import { CompanyService } from '../company/company.service';

describe('PayrollAllowanceRuleService', () => {
  let service: PayrollAllowanceRuleService;

  // ======= Mocks =======
  const prisma = {
    payrollAllowanceRule: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const companyService = {
    getCompanyById: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollAllowanceRuleService,
        { provide: PrismaService, useValue: prisma },
        { provide: CompanyService, useValue: companyService },
      ],
    }).compile();

    service = module.get(PayrollAllowanceRuleService);
  });

  describe('create', () => {
    it('should throw when company not found', async () => {
      companyService.getCompanyById.mockResolvedValue(null);

      await expect(
        service.create('c1', {
          name: 'Allowance',
          percentage: 10,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.payrollAllowanceRule.create).not.toHaveBeenCalled();
    });

    it('should throw when both percentage and fixed_amount are missing', async () => {
      companyService.getCompanyById.mockResolvedValue({ company_id: 'c1' });

      await expect(
        service.create('c1', {
          name: 'Allowance',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.payrollAllowanceRule.create).not.toHaveBeenCalled();
    });

    it('should throw when both percentage and fixed_amount are provided', async () => {
      companyService.getCompanyById.mockResolvedValue({ company_id: 'c1' });

      await expect(
        service.create('c1', {
          name: 'Allowance',
          percentage: 10,
          fixed_amount: 10000,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.payrollAllowanceRule.create).not.toHaveBeenCalled();
    });

    it('should create rule with percentage', async () => {
      companyService.getCompanyById.mockResolvedValue({ company_id: 'c1' });
      prisma.payrollAllowanceRule.create.mockResolvedValue({ id: 'a1' });

      const dto: any = {
        name: '  Allowance A  ',
        percentage: 10,
      };

      const res = await service.create('c1', dto);

      expect(prisma.payrollAllowanceRule.create).toHaveBeenCalledWith({
        data: {
          company_id: 'c1',
          name: 'Allowance A',
          percentage: 10,
          fixed_amount: null,
        },
      });

      expect(res).toEqual({ id: 'a1' });
    });

    it('should create rule with fixed_amount', async () => {
      companyService.getCompanyById.mockResolvedValue({ company_id: 'c1' });
      prisma.payrollAllowanceRule.create.mockResolvedValue({ id: 'a2' });

      const dto: any = {
        name: 'Allowance B',
        fixed_amount: 25000,
      };

      const res = await service.create('c1', dto);

      expect(prisma.payrollAllowanceRule.create).toHaveBeenCalledWith({
        data: {
          company_id: 'c1',
          name: 'Allowance B',
          percentage: null,
          fixed_amount: 25000,
        },
      });

      expect(res).toEqual({ id: 'a2' });
    });
  });

  describe('findAllByCompany', () => {
    it('should return rules ordered by created_at asc', async () => {
      prisma.payrollAllowanceRule.findMany.mockResolvedValue([{ id: 'a1' }]);

      const res = await service.findAllByCompany('c1');

      expect(prisma.payrollAllowanceRule.findMany).toHaveBeenCalledWith({
        where: { company_id: 'c1', deleted_at: null },
        orderBy: { created_at: 'asc' },
      });

      expect(res).toEqual([{ id: 'a1' }]);
    });
  });

  describe('findOneByCompany', () => {
    it('should throw when rule not found', async () => {
      prisma.payrollAllowanceRule.findFirst.mockResolvedValue(null);

      await expect(service.findOneByCompany('c1', 'a1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should return rule when found', async () => {
      prisma.payrollAllowanceRule.findFirst.mockResolvedValue({ id: 'a1' });

      const res = await service.findOneByCompany('c1', 'a1');

      expect(prisma.payrollAllowanceRule.findFirst).toHaveBeenCalledWith({
        where: {
          payroll_allowance_rule_id: 'a1',
          company_id: 'c1',
          deleted_at: null,
        },
      });

      expect(res).toEqual({ id: 'a1' });
    });
  });

  describe('updateByCompany', () => {
    it('should throw when rule not found', async () => {
      prisma.payrollAllowanceRule.findFirst.mockResolvedValue(null);

      await expect(
        service.updateByCompany('c1', 'a1', {
          name: 'X',
          percentage: 10,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.payrollAllowanceRule.update).not.toHaveBeenCalled();
    });

    it('should throw when xor invalid (both missing)', async () => {
      prisma.payrollAllowanceRule.findFirst.mockResolvedValue({
        payroll_allowance_rule_id: 'a1',
      });

      await expect(
        service.updateByCompany('c1', 'a1', { name: 'X' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.payrollAllowanceRule.update).not.toHaveBeenCalled();
    });

    it('should update rule when valid', async () => {
      prisma.payrollAllowanceRule.findFirst.mockResolvedValue({
        payroll_allowance_rule_id: 'a1',
      });

      prisma.payrollAllowanceRule.update.mockResolvedValue({ id: 'a1' });

      const dto: any = {
        name: '  Updated  ',
        fixed_amount: 50000,
        is_active: true,
      };

      const res = await service.updateByCompany('c1', 'a1', dto);

      expect(prisma.payrollAllowanceRule.update).toHaveBeenCalledWith({
        where: { payroll_allowance_rule_id: 'a1' },
        data: {
          name: 'Updated',
          percentage: null,
          fixed_amount: 50000,
          is_active: true,
        },
      });

      expect(res).toEqual({ id: 'a1' });
    });
  });

  describe('removeByCompany', () => {
    it('should throw when rule not found', async () => {
      prisma.payrollAllowanceRule.findFirst.mockResolvedValue(null);

      await expect(service.removeByCompany('c1', 'a1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should soft delete rule (set deleted_at)', async () => {
      prisma.payrollAllowanceRule.findFirst.mockResolvedValue({
        payroll_allowance_rule_id: 'a1',
      });

      prisma.payrollAllowanceRule.update.mockResolvedValue({ id: 'a1' });

      const res = await service.removeByCompany('c1', 'a1');

      expect(prisma.payrollAllowanceRule.update).toHaveBeenCalledWith({
        where: { payroll_allowance_rule_id: 'a1' },
        data: { deleted_at: expect.any(Date) },
      });

      expect(res).toEqual({ id: 'a1' });
    });
  });
});
