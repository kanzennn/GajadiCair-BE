import { Module } from '@nestjs/common';
import { LeaveApplicationService } from './leave-application.service';
import { LeaveApplicationController } from './leave-application.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { S3Service } from 'src/common/services/s3/s3.service';
import { EmployeeModule } from '../employee/employee.module';

@Module({
  imports: [EmployeeModule],
  controllers: [LeaveApplicationController],
  providers: [LeaveApplicationService, PrismaService, S3Service],
})
export class LeaveApplicationModule {}
