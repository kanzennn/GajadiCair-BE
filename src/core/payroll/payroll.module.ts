import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { CustomMailerModule } from 'src/common/services/mailer/mailer.module';
import { CompanyModule } from '../company/company.module';
import { EmployeeModule } from '../employee/employee.module';

@Module({
  imports: [CustomMailerModule, CompanyModule, EmployeeModule],
  controllers: [PayrollController],
  providers: [PayrollService, PrismaService],
  exports: [PayrollService],
})
export class PayrollModule {}
