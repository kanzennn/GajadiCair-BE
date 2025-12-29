// payroll-allowance-rule.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';

import { PayrollAllowanceRuleController } from './payroll-allowance-rule.controller';
import { PayrollAllowanceRuleService } from './payroll-allowance-rule.service';

describe('PayrollAllowanceRuleController', () => {
  let controller: PayrollAllowanceRuleController;

  // ======= Mocks =======
  const service = {
    create: jest.fn(),
    findAllByCompany: jest.fn(),
    findOneByCompany: jest.fn(),
    updateByCompany: jest.fn(),
    removeByCompany: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PayrollAllowanceRuleController],
      providers: [{ provide: PayrollAllowanceRuleService, useValue: service }],
    }).compile();

    controller = module.get(PayrollAllowanceRuleController);
  });

  const makeReq = (sub: string) => ({ user: { sub } }) as any;

  describe('create', () => {
    it('should call service.create and wrap response', async () => {
      service.create.mockResolvedValue({ id: 'a1' });

      const dto = { name: 'Allowance', percentage: 10 } as any;

      const res = await controller.create(makeReq('c1'), dto);

      expect(service.create).toHaveBeenCalledWith('c1', dto);
      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Payroll allowance rule created',
        data: { id: 'a1' },
      });
    });
  });

  describe('findAll', () => {
    it('should call service.findAllByCompany and wrap response', async () => {
      service.findAllByCompany.mockResolvedValue([{ id: 'a1' }]);

      const res = await controller.findAll(makeReq('c1'));

      expect(service.findAllByCompany).toHaveBeenCalledWith('c1');
      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Payroll allowance rules retrieved',
        data: [{ id: 'a1' }],
      });
    });
  });

  describe('findOne', () => {
    it('should call service.findOneByCompany and wrap response', async () => {
      service.findOneByCompany.mockResolvedValue({ id: 'a1' });

      const res = await controller.findOne(makeReq('c1'), 'a1');

      expect(service.findOneByCompany).toHaveBeenCalledWith('c1', 'a1');
      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Payroll allowance rule retrieved',
        data: { id: 'a1' },
      });
    });
  });

  describe('update', () => {
    it('should call service.updateByCompany and wrap response', async () => {
      service.updateByCompany.mockResolvedValue({ id: 'a1', name: 'Updated' });

      const dto = { name: 'Updated', fixed_amount: 10000 } as any;

      const res = await controller.update(makeReq('c1'), 'a1', dto);

      expect(service.updateByCompany).toHaveBeenCalledWith('c1', 'a1', dto);
      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Payroll allowance rule updated',
        data: { id: 'a1', name: 'Updated' },
      });
    });
  });

  describe('remove', () => {
    it('should call service.removeByCompany and wrap response', async () => {
      service.removeByCompany.mockResolvedValue({ id: 'a1' });

      const res = await controller.remove(makeReq('c1'), 'a1');

      expect(service.removeByCompany).toHaveBeenCalledWith('c1', 'a1');
      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Payroll allowance rule deleted',
        data: { id: 'a1' },
      });
    });
  });
});
