import { Injectable } from '@nestjs/common';
import axios, { AxiosError, AxiosResponse } from 'axios';
import FormData from 'form-data';

import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { InternalServerErrorException } from 'src/common/exceptions/internalServerError.exception';

import { HasFaceResponseInterface } from './interfaces/has-face-response.interfaces';
import { VerifyFaceResponseInterface } from './interfaces/verify-face-response.interfaces';

type PythonDetail = {
  error?: string;
  message?: string;
};

type PythonErrorBody = {
  detail?: PythonDetail;
};

@Injectable()
export class FaceRecognitionService {
  private readonly pythonUrl =
    process.env.PYTHON_FACEREC_URL || 'http://localhost:8001';

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------
  // Helpers
  // -------------------------

  private buildSingleFileForm(file: Express.Multer.File, field = 'file') {
    const form = new FormData();
    form.append(field, file.buffer, {
      filename: file.originalname || 'frame.jpg',
      contentType: file.mimetype || 'image/jpeg',
    });
    return form;
  }

  private handleAxiosError(
    err: unknown,
    context: string,
    map400?: (detail?: PythonDetail) => never,
  ): never {
    if (err instanceof AxiosError) {
      const status = err.response?.status;
      const data = err.response?.data as PythonErrorBody | undefined;
      const detail = data?.detail;

      console.log(`Python ${context} error:`, data ?? err.message);

      if (status === 400) {
        if (map400) map400(detail);
        throw new BadRequestException(
          detail?.message || `Bad request during ${context}`,
        );
      }

      throw new InternalServerErrorException(
        `Internal server error during ${context}`,
      );
    }

    if (err instanceof BadRequestException) throw err;

    console.log(`Unknown error ${context}:`, err);
    throw new BadRequestException(`Failed to ${context}`);
  }

  // -------------------------
  // Public methods
  // -------------------------

  async checkFace(file: Express.Multer.File) {
    const form = this.buildSingleFileForm(file, 'file');

    try {
      const res = await axios.post<HasFaceResponseInterface>(
        `${this.pythonUrl}/has-face`,
        form,
        { headers: form.getHeaders() },
      );

      return res.data;
    } catch (err) {
      return this.handleAxiosError(err, 'face check', (detail) => {
        if (detail?.error === 'file_too_large') {
          throw new BadRequestException('Uploaded file is too large');
        }
        if (detail?.error === 'invalid_file_type') {
          throw new BadRequestException('Invalid file type uploaded');
        }
        throw new BadRequestException(
          detail?.message || 'Bad request during face check',
        );
      });
    }
  }

  async enrollFace(files: Express.Multer.File[], employeeId: string) {
    const enrolled = await this.prisma.employee.findUnique({
      where: { employee_id: employeeId },
      select: { is_face_enrolled: true },
    });

    if (enrolled?.is_face_enrolled) {
      throw new BadRequestException(
        'You have already enrolled your face data before',
      );
    }

    const form = new FormData();
    for (const file of files) {
      form.append('files', file.buffer, {
        filename: file.originalname || 'frame.jpg',
        contentType: file.mimetype || 'image/jpeg',
      });
    }
    form.append('employee_id', employeeId);

    try {
      const res: AxiosResponse<Record<string, any>> = await axios.post(
        `${this.pythonUrl}/enroll`,
        form,
        { headers: form.getHeaders() },
      );

      await this.prisma.employee.update({
        where: { employee_id: employeeId },
        data: { is_face_enrolled: true },
      });

      return res.data;
    } catch (err) {
      return this.handleAxiosError(err, 'face enrollment', (detail) => {
        if (detail?.error === 'employee_exists') {
          throw new BadRequestException(
            'You have already enrolled your face data before',
          );
        }
        if (detail?.error === 'invalid_employee_id') {
          throw new BadRequestException('The provided employee ID is invalid');
        }
        throw new BadRequestException(
          detail?.message || 'Bad request during face enrollment',
        );
      });
    }
  }

  async verifyFace(file: Express.Multer.File, employeeId: string) {
    const enrolled = await this.prisma.employee.findUnique({
      where: { employee_id: employeeId },
      select: { is_face_enrolled: true },
    });

    if (!enrolled) throw new BadRequestException('Employee not found');
    if (!enrolled.is_face_enrolled) {
      throw new BadRequestException('You have not enrolled your face data yet');
    }

    const form = this.buildSingleFileForm(file, 'file');

    try {
      const res = await axios.post<VerifyFaceResponseInterface>(
        `${this.pythonUrl}/recognize`,
        form,
        { headers: form.getHeaders() },
      );

      // res.data sudah type-safe
      if (res.data.employee_id !== employeeId) {
        throw new BadRequestException('Face does not match');
      }

      return res.data; // return VerifyFacePythonResponse
    } catch (err) {
      return this.handleAxiosError(err, 'face verification', (detail) => {
        if (detail?.error === 'no_dataset') {
          throw new BadRequestException(
            'No face data found for this employee. Please enroll first.',
          );
        }
        if (detail?.error === 'no_face') {
          throw new BadRequestException(
            'No face detected in the provided image. Please try again.',
          );
        }
        throw new BadRequestException(
          detail?.message || 'Bad request during face verification',
        );
      });
    }
  }

  async deleteFaceData(employeeId: string) {
    const enrolled = await this.prisma.employee.findUnique({
      where: { employee_id: employeeId },
      select: { is_face_enrolled: true },
    });

    if (!enrolled) throw new BadRequestException('Employee not found');
    if (!enrolled.is_face_enrolled) {
      throw new BadRequestException('You have not enrolled your face data yet');
    }

    try {
      // Paling aman kirim JSON body; FormData pada axios.delete sering bikin server ga kebaca.
      await axios.delete(`${this.pythonUrl}/delete`, {
        data: { employee_id: employeeId },
      });

      return await this.prisma.employee.update({
        where: { employee_id: employeeId },
        data: { is_face_enrolled: false },
      });
    } catch (err) {
      return this.handleAxiosError(err, 'face data deletion', (detail) => {
        if (detail?.error === 'dataset_not_found') {
          throw new BadRequestException('No face data found for this user');
        }
        if (detail?.error === 'invalid_employee_id') {
          throw new BadRequestException('The provided employee ID is invalid');
        }
        throw new BadRequestException(
          detail?.message || 'Bad request during face data deletion',
        );
      });
    }
  }

  async getGestureList() {
    try {
      const res: AxiosResponse<Record<string, any>> = await axios.get(
        `${this.pythonUrl}/allowed-gestures`,
      );
      return res.data;
    } catch (err) {
      if (err instanceof AxiosError) {
        console.log(
          'Python get-gesture-list error:',
          err.response?.data || err.message,
        );
        throw new InternalServerErrorException(
          'Internal server error during fetching gesture list',
        );
      }

      console.log('Unknown error get-gesture-list:', err);
      throw new BadRequestException('Failed to get gesture list');
    }
  }
}
