import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { CustomMailerModule } from 'src/common/services/mailer/mailer.module';
import { CompanyService } from '../company/company.service';
import { EmployeeService } from '../employee/employee.service';

@Module({
  imports: [CustomMailerModule],
  controllers: [PayrollController],
  providers: [PayrollService, PrismaService, CompanyService, EmployeeService],
  exports: [PayrollService], // ⬅️ PENTING
})
export class PayrollModule {}
