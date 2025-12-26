import { Module } from '@nestjs/common';
import { PayrollAllowanceRuleService } from './payroll-allowance-rule.service';
import { PayrollAllowanceRuleController } from './payroll-allowance-rule.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { CompanyModule } from '../company/company.module';

@Module({
  imports: [CompanyModule],
  controllers: [PayrollAllowanceRuleController],
  providers: [PayrollAllowanceRuleService, PrismaService],
})
export class PayrollAllowanceRuleModule {}
