import { Module } from '@nestjs/common';
import { PayrollAllowanceRuleService } from './payroll-allowance-rule.service';
import { PayrollAllowanceRuleController } from './payroll-allowance-rule.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { CompanyService } from '../company/company.service';

@Module({
  controllers: [PayrollAllowanceRuleController],
  providers: [PayrollAllowanceRuleService, PrismaService, CompanyService],
})
export class PayrollAllowanceRuleModule {}
