import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { FaceRecognitionService } from '../face-recognition/face-recognition.service';
import { AttendanceJobService } from 'src/jobs/attendance.job';
import { EmployeeModule } from '../employee/employee.module';
import { CompanyService } from '../company/company.service';

@Module({
  controllers: [AttendanceController],
  providers: [
    AttendanceService,
    PrismaService,
    FaceRecognitionService,
    AttendanceJobService,
    CompanyService,
  ],
  imports: [EmployeeModule],
})
export class AttendanceModule {}
