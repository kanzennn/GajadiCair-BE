import { Module } from '@nestjs/common';
import { FaceRecognitionService } from './face-recognition.service';
import { FaceRecognitionController } from './face-recognition.controller';

@Module({
  controllers: [FaceRecognitionController],
  providers: [FaceRecognitionService],
})
export class FaceRecognitionModule {}
