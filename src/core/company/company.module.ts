import { Module } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { EmployeeModule } from '../employee/employee.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { S3Service } from 'src/common/services/s3/s3.service';

@Module({
  imports: [EmployeeModule, SubscriptionModule],
  controllers: [CompanyController],
  providers: [CompanyService, PrismaService, S3Service],
  exports: [CompanyService],
})
export class CompanyModule {}
