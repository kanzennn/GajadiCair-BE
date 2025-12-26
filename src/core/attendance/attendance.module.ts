import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';

import { EmployeeModule } from '../employee/employee.module';
import { CompanyModule } from '../company/company.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { FaceRecognitionModule } from '../face-recognition/face-recognition.module';

@Module({
  imports: [
    EmployeeModule,
    CompanyModule,
    SubscriptionModule,
    FaceRecognitionModule, // ⬅️ INI YANG KURANG
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService, PrismaService],
})
export class AttendanceModule {}
