import { Module } from '@nestjs/common';
import { FaceRecognitionService } from './face-recognition.service';
import { FaceRecognitionController } from './face-recognition.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';

@Module({
  controllers: [FaceRecognitionController],
  providers: [FaceRecognitionService, PrismaService],
  exports: [FaceRecognitionService],
})
export class FaceRecognitionModule {}
