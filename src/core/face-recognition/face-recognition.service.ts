import { Injectable } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import FormData from 'form-data';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { InternalServerErrorException } from 'src/common/exceptions/internalServerError.exception';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { HasFaceResponseDto } from './dto/has-face-response.dto';

@Injectable()
export class FaceRecognitionService {
  private readonly pythonUrl =
    process.env.PYTHON_FACEREC_URL || 'http://localhost:8001';

  constructor(private readonly prisma: PrismaService) {}

  async checkFace(file: Express.Multer.File) {
    const form = new FormData();
    form.append('file', file.buffer, {
      filename: file.originalname || 'frame.jpg',
      contentType: file.mimetype || 'image/jpeg',
    });

    try {
      const res = await axios.post(`${this.pythonUrl}/has-face`, form, {
        headers: form.getHeaders(),
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return res.data;
    } catch (err) {
      if (err instanceof AxiosError) {
        console.log(
          'Python check-face error:',
          err.response?.data || err.message,
        );

        if (err.response?.status === 400) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (err.response?.data?.detail?.error === 'file_too_large') {
            throw new BadRequestException('Uploaded file is too large');
          } else if (
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            err.response?.data?.detail?.error === 'invalid_file_type'
          ) {
            throw new BadRequestException('Invalid file type uploaded');
          } else {
            throw new BadRequestException(
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
              err.response?.data?.detail?.message ||
                'Bad request during face check',
            );
          }
        }

        throw new InternalServerErrorException(
          'Internal server error during face check',
        );
      }

      console.log('Unknown error check-face:', err);
      if (err instanceof BadRequestException) {
        throw err;
      }

      throw new BadRequestException('Failed to check face');
    }
  }

  async enrollFace(files: Express.Multer.File[], employeeId: string) {
    const userAlreadyEnrolled = await this.prisma.employee.findUnique({
      where: { employee_id: employeeId },
      select: { is_face_enrolled: true },
    });
    if (userAlreadyEnrolled?.is_face_enrolled) {
      throw new BadRequestException(
        'You have already enrolled your face data before',
      );
    }
    const form = new FormData();

    files.forEach((file) => {
      form.append('files', file.buffer, {
        filename: file.originalname || 'frame.jpg',
        contentType: file.mimetype || 'image/jpeg',
      });
    });

    form.append('employee_id', employeeId);

    try {
      const res = await axios.post(`${this.pythonUrl}/enroll`, form, {
        headers: {
          ...form.getHeaders(),
        },
      });

      await this.prisma.employee.update({
        where: { employee_id: employeeId },
        data: { is_face_enrolled: true },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return res.data;
    } catch (err) {
      if (err instanceof AxiosError) {
        console.log(
          'Python enroll-face error:',
          err.response?.data || err.message,
        );

        if (err.response?.status === 400) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (err.response?.data?.detail?.error === 'employee_exists') {
            throw new BadRequestException(
              'You have already enrolled your face data before',
            );
          } else if (
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            err.response?.data?.detail?.error === 'invalid_employee_id'
          ) {
            throw new BadRequestException(
              'The provided employee ID is invalid',
            );
          } else {
            throw new BadRequestException(
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
              err.response?.data?.detail?.message ||
                'Bad request during face enrollment',
            );
          }
        }

        throw new InternalServerErrorException(
          'Internal server error during face enrollment',
        );
      }

      console.log('Unknown error enroll-face:', err);
      if (err instanceof BadRequestException) {
        throw err;
      }

      throw new BadRequestException('Failed to enroll face');
    }
  }

  async verifyFace(file: Express.Multer.File, employeeId: string) {
    const userAlreadyEnrolled = await this.prisma.employee.findUnique({
      where: { employee_id: employeeId },
      select: { is_face_enrolled: true },
    });
    if (userAlreadyEnrolled?.is_face_enrolled) {
      throw new BadRequestException(
        'You have already enrolled your face data before',
      );
    }

    const form = new FormData();
    form.append('file', file.buffer, {
      filename: file.originalname || 'frame.jpg',
      contentType: file.mimetype || 'image/jpeg',
    });

    try {
      const res: HasFaceResponseDto = await axios.post(
        `${this.pythonUrl}/recognize`,
        form,
        {
          headers: form.getHeaders(),
        },
      );

      if (res.data.employee_id !== employeeId) {
        throw new BadRequestException('Face does not match');
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return res.data;
    } catch (err) {
      if (err instanceof AxiosError) {
        console.log(
          'Python verify-face error:',
          err.response?.data || err.message,
        );

        if (err.response?.status === 400) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (err.response?.data?.detail?.error === 'no_dataset') {
            throw new BadRequestException(
              'No face data found for this employee. Please enroll first.',
            );
          } else if (
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            err.response?.data?.detail?.error === 'no_face'
          ) {
            throw new BadRequestException(
              'No face detected in the provided image. Please try again.',
            );
          } else {
            throw new BadRequestException(
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
              err.response?.data?.detail?.message ||
                'Bad request during face verification',
            );
          }
        }

        throw new InternalServerErrorException(
          'Internal server error during face verification',
        );
      }

      console.log('Unknown error verify-face:', err);
      if (err instanceof BadRequestException) {
        throw err;
      }

      throw new BadRequestException('Failed to verify face');
    }
  }

  async deleteFaceData(employeeId: string) {
    try {
      const isUserEnrolled = await this.prisma.employee.findUnique({
        where: { employee_id: employeeId },
        select: { is_face_enrolled: true },
      });

      if (!isUserEnrolled) {
        throw new BadRequestException('Employee not found');
      }

      if (!isUserEnrolled.is_face_enrolled) {
        throw new BadRequestException(
          'You have not enrolled your face data yet',
        );
      }

      const form = new FormData();

      form.append('employee_id', employeeId);

      const res = await axios.delete(`${this.pythonUrl}/delete`, {
        data: form,
        headers: {
          ...form.getHeaders(),
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return res.data;
    } catch (err) {
      if (err instanceof AxiosError) {
        console.log(
          'Python delete-face-data error:',
          err.response?.data || err.message,
        );

        if (err.response?.status === 400) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (err.response?.data?.detail?.error === 'dataset_not_found') {
            throw new BadRequestException('No face data found for this user');
          } else if (
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            err.response?.data?.detail?.error === 'invalid_employee_id'
          ) {
            throw new BadRequestException(
              'The provided employee ID is invalid',
            );
          } else {
            throw new BadRequestException(
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
              err.response?.data?.detail?.message ||
                'Bad request during face data deletion',
            );
          }
        }

        throw new InternalServerErrorException(
          'Internal server error during face data deletion',
        );
      }

      if (err instanceof BadRequestException) {
        throw err;
      }

      console.log('Unknown error delete-face-data:', err);
      throw new BadRequestException('Failed to delete face data');
    }
  }
}
