import { Module } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { BankService } from '../bank/bank.service';
import { EmployeeModule } from '../employee/employee.module';

@Module({
  imports: [EmployeeModule],
  controllers: [CompanyController],
  providers: [CompanyService, BankService, PrismaService],
  exports: [CompanyService],
})
export class CompanyModule {}
