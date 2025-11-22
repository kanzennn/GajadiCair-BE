import { Test, TestingModule } from '@nestjs/testing';
import { FaceRecognitionController } from './face-recognition.controller';
import { FaceRecognitionService } from './face-recognition.service';

describe('FaceRecognitionController', () => {
  let controller: FaceRecognitionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FaceRecognitionController],
      providers: [FaceRecognitionService],
    }).compile();

    controller = module.get<FaceRecognitionController>(
      FaceRecognitionController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
