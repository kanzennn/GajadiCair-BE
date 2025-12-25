import { Test, TestingModule } from '@nestjs/testing';
import { PayrollDeductionRuleService } from './payroll-deduction-rule.service';

describe('PayrollDeductionRuleService', () => {
  let service: PayrollDeductionRuleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PayrollDeductionRuleService],
    }).compile();

    service = module.get<PayrollDeductionRuleService>(PayrollDeductionRuleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
