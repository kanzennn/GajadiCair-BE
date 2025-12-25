import { Test, TestingModule } from '@nestjs/testing';
import { PayrollAllowanceRuleController } from './payroll-allowance-rule.controller';
import { PayrollAllowanceRuleService } from './payroll-allowance-rule.service';

describe('PayrollAllowanceRuleController', () => {
  let controller: PayrollAllowanceRuleController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PayrollAllowanceRuleController],
      providers: [PayrollAllowanceRuleService],
    }).compile();

    controller = module.get<PayrollAllowanceRuleController>(PayrollAllowanceRuleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
