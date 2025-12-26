import { Module, forwardRef } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { CustomMailerModule } from 'src/common/services/mailer/mailer.module';
import { BankModule } from '../bank/bank.module';
import { CompanyModule } from '../company/company.module';
import { S3Service } from 'src/common/services/s3/s3.service';

@Module({
  imports: [CustomMailerModule, BankModule, forwardRef(() => CompanyModule)],
  controllers: [EmployeeController],
  providers: [EmployeeService, PrismaService, S3Service],
  exports: [EmployeeService],
})
export class EmployeeModule {}
