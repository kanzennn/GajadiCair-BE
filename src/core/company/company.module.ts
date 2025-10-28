import { Module } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { EmployeeService } from '../employee/employee.service';
import { BankService } from '../bank/bank.service';

@Module({
  controllers: [CompanyController],
  providers: [CompanyService, EmployeeService, BankService, PrismaService],
})
export class CompanyModule {}
