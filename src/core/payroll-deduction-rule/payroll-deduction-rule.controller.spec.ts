// payroll-deduction-rule.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';

import { PayrollDeductionRuleController } from './payroll-deduction-rule.controller';
import { PayrollDeductionRuleService } from './payroll-deduction-rule.service';

describe('PayrollDeductionRuleController', () => {
  let controller: PayrollDeductionRuleController;

  // ======= Mocks =======
  const payrollDeductionRuleService = {
    create: jest.fn(),
    findAllByCompany: jest.fn(),
    findOneByCompany: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PayrollDeductionRuleController],
      providers: [
        {
          provide: PayrollDeductionRuleService,
          useValue: payrollDeductionRuleService,
        },
      ],
    }).compile();

    controller = module.get(PayrollDeductionRuleController);
  });

  const makeReq = (sub: string) => ({ user: { sub } }) as any;

  describe('create', () => {
    it('should call service.create and wrap response', async () => {
      payrollDeductionRuleService.create.mockResolvedValue({ id: 'r1' });

      const dto = { name: 'Late', type: 'LATE' } as any;

      const res = await controller.create(makeReq('c1'), dto);

      expect(payrollDeductionRuleService.create).toHaveBeenCalledWith(
        'c1',
        dto,
      );

      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Payroll deduction rule created',
        data: { id: 'r1' },
      });
    });
  });

  describe('findAll', () => {
    it('should call service.findAllByCompany and wrap response', async () => {
      payrollDeductionRuleService.findAllByCompany.mockResolvedValue([
        { id: 'r1' },
      ]);

      const res = await controller.findAll(makeReq('c1'));

      expect(payrollDeductionRuleService.findAllByCompany).toHaveBeenCalledWith(
        'c1',
      );

      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Payroll deduction rules retrieved',
        data: [{ id: 'r1' }],
      });
    });
  });

  describe('findOne', () => {
    it('should call service.findOneByCompany and wrap response', async () => {
      payrollDeductionRuleService.findOneByCompany.mockResolvedValue({
        id: 'r1',
      });

      const res = await controller.findOne(makeReq('c1'), 'r1');

      expect(payrollDeductionRuleService.findOneByCompany).toHaveBeenCalledWith(
        'c1',
        'r1',
      );

      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Payroll deduction rule retrieved',
        data: { id: 'r1' },
      });
    });
  });

  describe('update', () => {
    it('should call service.update and wrap response', async () => {
      payrollDeductionRuleService.update.mockResolvedValue({
        id: 'r1',
        name: 'U',
      });

      const dto = { name: 'Updated' } as any;

      const res = await controller.update(makeReq('c1'), 'r1', dto);

      expect(payrollDeductionRuleService.update).toHaveBeenCalledWith(
        'c1',
        'r1',
        dto,
      );

      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Payroll deduction rule updated',
        data: { id: 'r1', name: 'U' },
      });
    });
  });

  describe('remove', () => {
    it('should call service.remove and wrap response', async () => {
      payrollDeductionRuleService.remove.mockResolvedValue({ id: 'r1' });

      const res = await controller.remove(makeReq('c1'), 'r1');

      expect(payrollDeductionRuleService.remove).toHaveBeenCalledWith(
        'c1',
        'r1',
      );

      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Payroll deduction rule deleted',
        data: { id: 'r1' },
      });
    });
  });
});
