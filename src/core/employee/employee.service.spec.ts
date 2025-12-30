// employee.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';

import { EmployeeService } from './employee.service';

import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { CustomMailerService } from 'src/common/services/mailer/mailer.service';
import { S3Service } from 'src/common/services/s3/s3.service';

import { CompanyService } from '../company/company.service';
import { FaceRecognitionService } from '../face-recognition/face-recognition.service';

import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

// ✅ Mock argon2 (hash) biar test stabil
jest.mock('argon2', () => ({
  hash: jest.fn((v: string) => `hashed:${v}`),
}));

describe('EmployeeService', () => {
  let service: EmployeeService;

  // ======= Mocks =======
  const prisma = {
    employee: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mailerService = {
    sendTemplatedEmail: jest.fn(),
  };

  const companyService = {
    getAvailableSeats: jest.fn(),
  };

  const s3Service = {
    uploadBuffer: jest.fn(),
  };

  const faceRecognitionService = {
    deleteFaceData: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeService,
        { provide: PrismaService, useValue: prisma },
        { provide: CustomMailerService, useValue: mailerService },
        { provide: CompanyService, useValue: companyService },
        { provide: S3Service, useValue: s3Service },
        { provide: FaceRecognitionService, useValue: faceRecognitionService }, // ✅ NEW
      ],
    }).compile();

    service = module.get(EmployeeService);
  });

  describe('updateEmployeeProfile', () => {
    it('should throw when employee not found', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.updateEmployeeProfile('e1', { name: 'A' } as any, null as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should update profile without file and sanitize password', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        employee_id: 'e1',
        deleted_at: null,
      });

      prisma.employee.update.mockResolvedValue({
        employee_id: 'e1',
        name: 'New',
        password: 'hashed:any',
      });

      const res = await service.updateEmployeeProfile(
        'e1',
        { name: 'New' } as any,
        null as any,
      );

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { employee_id: 'e1' },
        data: { name: 'New' },
      });

      expect(res).toEqual({
        employee_id: 'e1',
        name: 'New',
        password: undefined,
      });
    });

    it('should upload file to s3 and set avatar_uri then update', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        employee_id: 'e1',
        deleted_at: null,
      });

      s3Service.uploadBuffer.mockResolvedValue({
        key: 'employee/profile-picture/123-a.png',
      });

      prisma.employee.update.mockResolvedValue({
        employee_id: 'e1',
        avatar_uri: 'employee/profile-picture/123-a.png',
        password: 'hashed:any',
      });

      const file = {
        originalname: 'a.png',
        mimetype: 'image/png',
        buffer: Buffer.from('x'),
      } as Express.Multer.File;

      const dto: any = {};

      const res = await service.updateEmployeeProfile('e1', dto, file);

      expect(s3Service.uploadBuffer).toHaveBeenCalled();
      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { employee_id: 'e1' },
        data: expect.objectContaining({
          avatar_uri: 'employee/profile-picture/123-a.png',
        }),
      });

      expect(res.password).toBeUndefined();
    });
  });

  describe('createEmployeeByCompany', () => {
    it('should throw when seat capacity exceeded', async () => {
      companyService.getAvailableSeats.mockResolvedValue({
        seat_availability: 0,
      });

      await expect(
        service.createEmployeeByCompany('c1', {
          username: 'u',
          password: 'p',
          send_to_email: false,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw when username already taken', async () => {
      companyService.getAvailableSeats.mockResolvedValue({
        seat_availability: 10,
      });

      prisma.employee.findFirst.mockResolvedValue({
        employee_id: 'e-existing',
        username: 'u',
      });

      await expect(
        service.createEmployeeByCompany('c1', {
          username: 'u',
          password: 'p',
          send_to_email: false,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should create employee, hash password, and sanitize password', async () => {
      companyService.getAvailableSeats.mockResolvedValue({
        seat_availability: 10,
      });

      prisma.employee.findFirst.mockResolvedValue(null);

      prisma.employee.create.mockResolvedValue({
        employee_id: 'e1',
        email: 'e@e.com',
        username: 'u',
        name: 'Emp',
        password: 'hashed:p',
        company: { name: 'Comp', company_identifier: 'CID' },
      });

      const res = await service.createEmployeeByCompany('c1', {
        username: 'u',
        password: 'p',
        email: 'e@e.com',
        name: 'Emp',
        send_to_email: false,
      } as any);

      expect(prisma.employee.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          company_id: 'c1',
          username: 'u',
          password: 'hashed:p',
        }),
        include: { company: true },
      });

      expect(res.password).toBeUndefined();
    });

    it('should send credentials email when send_to_email = true', async () => {
      companyService.getAvailableSeats.mockResolvedValue({
        seat_availability: 10,
      });

      prisma.employee.findFirst.mockResolvedValue(null);

      prisma.employee.create.mockResolvedValue({
        employee_id: 'e1',
        email: 'e@e.com',
        username: 'u',
        name: 'Emp',
        password: 'hashed:p',
        company: { name: 'Comp', company_identifier: 'CID' },
      });

      const res = await service.createEmployeeByCompany('c1', {
        username: 'u',
        password: 'p',
        email: 'e@e.com',
        name: 'Emp',
        send_to_email: true,
      } as any);

      expect(mailerService.sendTemplatedEmail).toHaveBeenCalledWith(
        'e@e.com',
        'Selamat Bergabung!',
        'send-credentials',
        expect.objectContaining({
          employeeName: 'Emp',
          companyName: 'Comp',
          companyCode: 'CID',
          employeeUsername: 'u',
          password: 'p',
        }),
      );

      expect(res.password).toBeUndefined();
    });
  });

  describe('getEmployeesByCompany', () => {
    it('should return employees list (selected fields)', async () => {
      prisma.employee.findMany.mockResolvedValue([
        { employee_id: 'e1', name: 'A' },
      ]);

      const res = await service.getEmployeesByCompany('c1');

      expect(prisma.employee.findMany).toHaveBeenCalled();
      expect(res).toEqual([{ employee_id: 'e1', name: 'A' }]);
    });
  });

  describe('getCountEmployeesByCompany', () => {
    it('should return employee count', async () => {
      prisma.employee.count.mockResolvedValue(5);

      const res = await service.getCountEmployeesByCompany('c1');

      expect(prisma.employee.count).toHaveBeenCalledWith({
        where: { company_id: 'c1', deleted_at: null },
      });
      expect(res).toBe(5);
    });
  });

  describe('getEmployeeByIdByCompany', () => {
    it('should throw when employee not found', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.getEmployeeByIdByCompany('c1', 'e1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should return employee sanitized', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        employee_id: 'e1',
        password: 'hashed:any',
      });

      const res = await service.getEmployeeByIdByCompany('c1', 'e1');

      expect(res).toEqual({ employee_id: 'e1', password: undefined });
    });
  });

  describe('updateEmployeeByIdByCompany', () => {
    it('should throw when username already taken by other employee', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        employee_id: 'e-other',
        username: 'new',
      });

      await expect(
        service.updateEmployeeByIdByCompany('c1', 'e1', {
          username: 'new',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should hash password when provided, update employee, and sanitize', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      prisma.employee.update.mockResolvedValue({
        employee_id: 'e1',
        username: 'u',
        password: 'hashed:new',
        company: { name: 'Comp', company_identifier: 'CID' },
      });

      const res = await service.updateEmployeeByIdByCompany('c1', 'e1', {
        password: 'new',
        send_to_email: false,
      } as any);

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { company_id: 'c1', employee_id: 'e1', deleted_at: null },
        data: expect.objectContaining({
          password: 'hashed:new',
        }),
        include: { company: true },
      });

      expect(res.password).toBeUndefined();
    });

    it('should send updated data email when only password changed and send_to_email = true', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      prisma.employee.update.mockResolvedValue({
        employee_id: 'e1',
        email: 'e@e.com',
        name: 'Emp',
        username: 'u',
        password: 'hashed:new',
        company: { name: 'Comp', company_identifier: 'CID' },
      });

      const res = await service.updateEmployeeByIdByCompany('c1', 'e1', {
        password: 'new',
        send_to_email: true,
      } as any);

      expect(mailerService.sendTemplatedEmail).toHaveBeenCalledWith(
        'e@e.com',
        'Pemberitahuan Penggantian Data Pengguna',
        'send-updated-data-user',
        expect.objectContaining({
          employeeName: 'Emp',
          companyName: 'Comp',
        }),
      );

      expect(res.password).toBeUndefined();
    });

    it('should send new credentials email when username changes and send_to_email = true', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      prisma.employee.update.mockResolvedValue({
        employee_id: 'e1',
        email: 'e@e.com',
        name: 'Emp',
        username: 'newU',
        password: 'hashed:any',
        company: { name: 'Comp', company_identifier: 'CID' },
      });

      const res = await service.updateEmployeeByIdByCompany('c1', 'e1', {
        username: 'newU',
        send_to_email: true,
      } as any);

      expect(mailerService.sendTemplatedEmail).toHaveBeenCalledWith(
        'e@e.com',
        'Pemberitahuan Penggantian Kredensial',
        'send-new-credentials',
        expect.objectContaining({
          employeeName: 'Emp',
          companyName: 'Comp',
          companyCode: 'CID',
          employeeUsername: 'newU',
        }),
      );

      expect(res.password).toBeUndefined();
    });
  });

  describe('deleteEmployeeByIdByCompany', () => {
    it('should throw when employee not found', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteEmployeeByIdByCompany('c1', 'e1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should soft delete employee when not face enrolled', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        employee_id: 'e1',
        is_face_enrolled: false,
      });

      prisma.employee.update.mockResolvedValue({
        employee_id: 'e1',
        deleted_at: new Date(),
      });

      const res = await service.deleteEmployeeByIdByCompany('c1', 'e1');

      expect(faceRecognitionService.deleteFaceData).not.toHaveBeenCalled();

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { company_id: 'c1', employee_id: 'e1', deleted_at: null },
        data: { deleted_at: expect.any(Date) },
      });

      expect(res).toMatchObject({
        employee_id: 'e1',
        deleted_at: expect.any(Date),
      });
    });

    it('should delete face data first when face enrolled', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        employee_id: 'e1',
        is_face_enrolled: true,
      });

      faceRecognitionService.deleteFaceData.mockResolvedValue(true);

      prisma.employee.update.mockResolvedValue({
        employee_id: 'e1',
        deleted_at: new Date(),
      });

      await service.deleteEmployeeByIdByCompany('c1', 'e1');

      expect(faceRecognitionService.deleteFaceData).toHaveBeenCalledWith('e1');
      expect(prisma.employee.update).toHaveBeenCalled();
    });
  });

  describe('getEmployeeById', () => {
    it('should return employee by id', async () => {
      prisma.employee.findFirst.mockResolvedValue({ employee_id: 'e1' });

      const res = await service.getEmployeeById('e1');

      expect(prisma.employee.findFirst).toHaveBeenCalledWith({
        where: { employee_id: 'e1', deleted_at: null },
      });
      expect(res).toEqual({ employee_id: 'e1' });
    });
  });

  describe('getEmployeeByIdIncludeCompany', () => {
    it('should return employee include company', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        employee_id: 'e1',
        company: { company_id: 'c1' },
      });

      const res = await service.getEmployeeByIdIncludeCompany('e1');

      expect(prisma.employee.findFirst).toHaveBeenCalledWith({
        where: { employee_id: 'e1', deleted_at: null },
        include: { company: true },
      });
      expect(res).toEqual({ employee_id: 'e1', company: { company_id: 'c1' } });
    });
  });

  describe('getEmployeeByUsernameByCompany', () => {
    it('should find employee by username + company', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        employee_id: 'e1',
        username: 'u',
        company_id: 'c1',
      });

      const res = await service.getEmployeeByUsernameByCompany('u', 'c1');

      expect(prisma.employee.findFirst).toHaveBeenCalledWith({
        where: { username: 'u', company_id: 'c1', deleted_at: null },
      });
      expect(res).toEqual({
        employee_id: 'e1',
        username: 'u',
        company_id: 'c1',
      });
    });
  });
});
