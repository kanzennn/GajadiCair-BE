import { Test, TestingModule } from '@nestjs/testing';
import axios, { AxiosError } from 'axios';

import { FaceRecognitionService } from './face-recognition.service';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { InternalServerErrorException } from 'src/common/exceptions/internalServerError.exception';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    delete: jest.fn(),
    get: jest.fn(),
  },
}));
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FaceRecognitionService', () => {
  let service: FaceRecognitionService;

  const prisma = {
    employee: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const makeFile = (overrides: Partial<Express.Multer.File> = {}) =>
    ({
      buffer: Buffer.from('x'),
      originalname: 'a.jpg',
      mimetype: 'image/jpeg',
      ...overrides,
    }) as any;

  const makeAxiosError = (params: {
    status: number;
    data?: any;
    message?: string;
    url?: string;
    method?: string;
  }) => {
    const err = new AxiosError(
      params.message ?? 'Axios error',
      undefined,
      {
        url: params.url ?? 'http://python',
        method: params.method ?? 'POST',
      } as any,
      undefined,
      {
        status: params.status,
        statusText: String(params.status),
        headers: {},
        config: {} as any,
        data: params.data,
      },
    );
    return err;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaceRecognitionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(FaceRecognitionService);

    // biar deterministic
    (service as any).pythonUrl = 'http://python';
  });

  // =========================
  // checkFace
  // =========================
  describe('checkFace', () => {
    it('should return python response data', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { has_face: true },
      } as any);

      const res = await service.checkFace(makeFile());

      expect(res).toEqual({ has_face: true });
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://python/has-face',
        expect.anything(),
        expect.objectContaining({ headers: expect.anything() }),
      );
    });

    it('should throw BadRequestException when file_too_large', async () => {
      mockedAxios.post.mockRejectedValueOnce(
        makeAxiosError({
          status: 400,
          data: { detail: { error: 'file_too_large' } },
        }),
      );

      await expect(service.checkFace(makeFile())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when invalid_file_type', async () => {
      mockedAxios.post.mockRejectedValueOnce(
        makeAxiosError({
          status: 400,
          data: { detail: { error: 'invalid_file_type' } },
        }),
      );

      await expect(service.checkFace(makeFile())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when 400 with message', async () => {
      mockedAxios.post.mockRejectedValueOnce(
        makeAxiosError({
          status: 400,
          data: { detail: { message: 'custom bad request' } },
        }),
      );

      await expect(service.checkFace(makeFile())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException when non-400 axios error', async () => {
      mockedAxios.post.mockRejectedValueOnce(
        makeAxiosError({ status: 500, data: { any: true } }),
      );

      await expect(service.checkFace(makeFile())).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('should throw BadRequestException when unknown non-axios error', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('boom'));

      await expect(service.checkFace(makeFile())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  // =========================
  // enrollFace
  // =========================
  describe('enrollFace', () => {
    it('should throw when already enrolled', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        is_face_enrolled: true,
      });

      await expect(
        service.enrollFace([makeFile()], 'e1'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockedAxios.post).not.toHaveBeenCalled();
      expect(prisma.employee.update).not.toHaveBeenCalled();
    });

    it('should enroll and update is_face_enrolled=true', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        is_face_enrolled: false,
      });
      mockedAxios.post.mockResolvedValueOnce({ data: { ok: true } } as any);
      prisma.employee.update.mockResolvedValueOnce({
        employee_id: 'e1',
        is_face_enrolled: true,
      });

      const res = await service.enrollFace([makeFile(), makeFile()], 'e1');

      expect(res).toEqual({ ok: true });
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://python/enroll',
        expect.anything(),
        expect.objectContaining({ headers: expect.anything() }),
      );
      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { employee_id: 'e1' },
        data: { is_face_enrolled: true },
      });
    });

    it('should map employee_exists to bad request', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        is_face_enrolled: false,
      });
      mockedAxios.post.mockRejectedValueOnce(
        makeAxiosError({
          status: 400,
          data: { detail: { error: 'employee_exists' } },
        }),
      );

      await expect(
        service.enrollFace([makeFile()], 'e1'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.employee.update).not.toHaveBeenCalled();
    });

    it('should map invalid_employee_id to bad request', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        is_face_enrolled: false,
      });
      mockedAxios.post.mockRejectedValueOnce(
        makeAxiosError({
          status: 400,
          data: { detail: { error: 'invalid_employee_id' } },
        }),
      );

      await expect(
        service.enrollFace([makeFile()], 'e1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw internal error when axios non-400', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        is_face_enrolled: false,
      });
      mockedAxios.post.mockRejectedValueOnce(makeAxiosError({ status: 500 }));

      await expect(
        service.enrollFace([makeFile()], 'e1'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  // =========================
  // verifyFace
  // =========================
  describe('verifyFace', () => {
    it('should throw when employee not found', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce(null);

      await expect(service.verifyFace(makeFile(), 'e1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should throw when not enrolled', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        is_face_enrolled: false,
      });

      await expect(service.verifyFace(makeFile(), 'e1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should throw when face mismatch', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        is_face_enrolled: true,
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { employee_id: 'OTHER', confidence: 0.8 },
      } as any);

      await expect(service.verifyFace(makeFile(), 'e1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should return data when face matches', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        is_face_enrolled: true,
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { employee_id: 'e1', confidence: 0.95 },
      } as any);

      const res = await service.verifyFace(makeFile(), 'e1');

      expect(res).toMatchObject({ employee_id: 'e1', confidence: 0.95 });
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://python/recognize',
        expect.anything(),
        expect.objectContaining({ headers: expect.anything() }),
      );
    });

    it('should map no_dataset to bad request', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        is_face_enrolled: true,
      });
      mockedAxios.post.mockRejectedValueOnce(
        makeAxiosError({
          status: 400,
          data: { detail: { error: 'no_dataset' } },
        }),
      );

      await expect(service.verifyFace(makeFile(), 'e1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should map no_face to bad request', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        is_face_enrolled: true,
      });
      mockedAxios.post.mockRejectedValueOnce(
        makeAxiosError({
          status: 400,
          data: { detail: { error: 'no_face' } },
        }),
      );

      await expect(service.verifyFace(makeFile(), 'e1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should throw internal error when axios non-400', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        is_face_enrolled: true,
      });
      mockedAxios.post.mockRejectedValueOnce(makeAxiosError({ status: 500 }));

      await expect(service.verifyFace(makeFile(), 'e1')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  // =========================
  // deleteFaceData
  // =========================
  describe('deleteFaceData', () => {
    it('should throw when employee not found', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce(null);

      await expect(service.deleteFaceData('e1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should throw when not enrolled', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        is_face_enrolled: false,
      });

      await expect(service.deleteFaceData('e1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should call python delete and update is_face_enrolled=false', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        is_face_enrolled: true,
      });
      mockedAxios.delete.mockResolvedValueOnce({ data: { ok: true } } as any);
      prisma.employee.update.mockResolvedValueOnce({
        employee_id: 'e1',
        is_face_enrolled: false,
      });

      const res = await service.deleteFaceData('e1');

      expect(mockedAxios.delete).toHaveBeenCalledWith('http://python/delete', {
        data: { employee_id: 'e1' },
      });

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { employee_id: 'e1' },
        data: { is_face_enrolled: false },
      });

      expect(res).toMatchObject({ employee_id: 'e1', is_face_enrolled: false });
    });

    it('should map dataset_not_found', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        is_face_enrolled: true,
      });
      mockedAxios.delete.mockRejectedValueOnce(
        makeAxiosError({
          status: 400,
          data: { detail: { error: 'dataset_not_found' } },
        }),
      );

      await expect(service.deleteFaceData('e1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should map invalid_employee_id', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        is_face_enrolled: true,
      });
      mockedAxios.delete.mockRejectedValueOnce(
        makeAxiosError({
          status: 400,
          data: { detail: { error: 'invalid_employee_id' } },
        }),
      );

      await expect(service.deleteFaceData('e1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should throw internal error when axios non-400', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        is_face_enrolled: true,
      });
      mockedAxios.delete.mockRejectedValueOnce(makeAxiosError({ status: 500 }));

      await expect(service.deleteFaceData('e1')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  // =========================
  // getGestureList
  // =========================
  describe('getGestureList', () => {
    it('should return gesture list response', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { gestures: ['A', 'B'] },
      } as any);

      const res = await service.getGestureList();

      expect(res).toEqual({ gestures: ['A', 'B'] });
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://python/allowed-gestures',
      );
    });

    it('should throw InternalServerErrorException on axios error', async () => {
      mockedAxios.get.mockRejectedValueOnce(makeAxiosError({ status: 500 }));

      await expect(service.getGestureList()).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('should throw BadRequestException on non-axios error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('boom'));

      await expect(service.getGestureList()).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
