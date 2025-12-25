import { Test, TestingModule } from '@nestjs/testing';
import { PayrollDeductionRuleController } from './payroll-deduction-rule.controller';
import { PayrollDeductionRuleService } from './payroll-deduction-rule.service';

describe('PayrollDeductionRuleController', () => {
  let controller: PayrollDeductionRuleController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PayrollDeductionRuleController],
      providers: [PayrollDeductionRuleService],
    }).compile();

    controller = module.get<PayrollDeductionRuleController>(PayrollDeductionRuleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
