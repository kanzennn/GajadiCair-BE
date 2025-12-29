// face-recognition.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';

import { FaceRecognitionController } from './face-recognition.controller';
import { FaceRecognitionService } from './face-recognition.service';

import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

describe('FaceRecognitionController', () => {
  let controller: FaceRecognitionController;

  const faceRecognitionService = {
    checkFace: jest.fn(),
    enrollFace: jest.fn(),
    deleteFaceData: jest.fn(),
    getGestureList: jest.fn(),
  };

  const makeReq = (sub: string) => ({ user: { sub } }) as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FaceRecognitionController],
      providers: [
        { provide: FaceRecognitionService, useValue: faceRecognitionService },
      ],
    }).compile();

    controller = module.get(FaceRecognitionController);
  });

  describe('checkFace', () => {
    it('should throw when no file uploaded', async () => {
      await expect(
        controller.checkFace(undefined as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(faceRecognitionService.checkFace).not.toHaveBeenCalled();
    });

    it('should call service and return successResponse', async () => {
      faceRecognitionService.checkFace.mockResolvedValue({ ok: true });

      const file = {
        originalname: 'a.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('x'),
      } as any;

      const res = await controller.checkFace(file);

      expect(faceRecognitionService.checkFace).toHaveBeenCalledWith(file);

      // successResponse biasanya: { statusCode, message, data }
      // message default tergantung utilmu, jadi kita match yang pasti aja
      expect(res).toMatchObject({
        statusCode: 200,
        data: { ok: true },
      });
    });
  });

  describe('enrollFace', () => {
    it('should throw when no files uploaded', async () => {
      await expect(
        controller.enrollFace(undefined as any, makeReq('e1')),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        controller.enrollFace([] as any, makeReq('e1')),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(faceRecognitionService.enrollFace).not.toHaveBeenCalled();
    });

    it('should call service and return successResponse', async () => {
      faceRecognitionService.enrollFace.mockResolvedValue({ enrolled: true });

      const files = [
        {
          originalname: '1.jpg',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('1'),
        },
        {
          originalname: '2.jpg',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('2'),
        },
      ] as any[];

      const res = await controller.enrollFace(files as any, makeReq('e1'));

      expect(faceRecognitionService.enrollFace).toHaveBeenCalledWith(
        files,
        'e1',
      );

      expect(res).toMatchObject({
        statusCode: 200,
        data: { enrolled: true },
      });
    });
  });

  describe('removeFace', () => {
    it('should call service and return successResponse', async () => {
      faceRecognitionService.deleteFaceData.mockResolvedValue({
        employee_id: 'e1',
        is_face_enrolled: false,
      });

      const res = await controller.removeFace(makeReq('e1'));

      expect(faceRecognitionService.deleteFaceData).toHaveBeenCalledWith('e1');

      expect(res).toMatchObject({
        statusCode: 200,
        data: {
          employee_id: 'e1',
          is_face_enrolled: false,
        },
      });
    });
  });

  describe('getGestureList', () => {
    it('should call service and return successResponse', async () => {
      faceRecognitionService.getGestureList.mockResolvedValue({
        gestures: ['thumbs_up', 'ok'],
      });

      const res = await controller.getGestureList();

      expect(faceRecognitionService.getGestureList).toHaveBeenCalled();

      expect(res).toMatchObject({
        statusCode: 200,
        data: { gestures: ['thumbs_up', 'ok'] },
      });
    });
  });
});
