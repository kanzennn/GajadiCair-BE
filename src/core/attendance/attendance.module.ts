import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { FaceRecognitionService } from '../face-recognition/face-recognition.service';

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService, PrismaService, FaceRecognitionService],
})
export class AttendanceModule {}
