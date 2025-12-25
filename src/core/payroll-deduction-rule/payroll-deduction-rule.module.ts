import { Module } from '@nestjs/common';
import { PayrollDeductionRuleService } from './payroll-deduction-rule.service';
import { PayrollDeductionRuleController } from './payroll-deduction-rule.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';

@Module({
  controllers: [PayrollDeductionRuleController],
  providers: [PayrollDeductionRuleService, PrismaService],
})
export class PayrollDeductionRuleModule {}
