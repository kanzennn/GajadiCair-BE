import { Test, TestingModule } from '@nestjs/testing';
import { PayrollAllowanceRuleService } from './payroll-allowance-rule.service';

describe('PayrollAllowanceRuleService', () => {
  let service: PayrollAllowanceRuleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PayrollAllowanceRuleService],
    }).compile();

    service = module.get<PayrollAllowanceRuleService>(PayrollAllowanceRuleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
