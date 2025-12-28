/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeService } from './employee.service';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { CustomMailerService } from 'src/common/services/mailer/mailer.service';
import { CompanyService } from '../company/company.service';
import { S3Service } from 'src/common/services/s3/s3.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

// ✅ Mock argon2
jest.mock('argon2', () => ({
  hash: jest.fn((v: string) => `hashed:${v}`),
}));

// ✅ Mock convertFilename biar key S3 predictable
jest.mock('src/utils/convertString.utils', () => ({
  convertFilename: jest.fn((name: string) => `safe-${name}`),
}));

describe('EmployeeService', () => {
  let service: EmployeeService;

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

  const s3 = {
    uploadBuffer: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeService,
        { provide: PrismaService, useValue: prisma },
        { provide: CustomMailerService, useValue: mailerService },
        { provide: CompanyService, useValue: companyService },
        { provide: S3Service, useValue: s3 },
      ],
    }).compile();

    service = module.get(EmployeeService);
  });

  describe('updateEmployeeProfile', () => {
    it('should throw if employee not found', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.updateEmployeeProfile(
          'e1',
          { name: 'New' } as any,
          null as any,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should update profile without file', async () => {
      prisma.employee.findFirst.mockResolvedValue({ employee_id: 'e1' });

      prisma.employee.update.mockResolvedValue({
        employee_id: 'e1',
        name: 'New',
        avatar_uri: null,
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
        avatar_uri: null,
      });
    });

    it('should upload avatar and update avatar_uri when file provided', async () => {
      prisma.employee.findFirst.mockResolvedValue({ employee_id: 'e1' });

      // uploadBuffer mengembalikan key yang nanti disimpan ke avatar_uri
      s3.uploadBuffer.mockResolvedValue({
        key: 'employee/profile-picture/abc.jpg',
      });

      prisma.employee.update.mockResolvedValue({
        employee_id: 'e1',
        name: 'New',
        avatar_uri: 'employee/profile-picture/abc.jpg',
      });

      const file = {
        originalname: 'photo.png',
        mimetype: 'image/png',
        buffer: Buffer.from('x'),
      } as any;

      const res = await service.updateEmployeeProfile(
        'e1',
        { name: 'New' } as any,
        file,
      );

      expect(s3.uploadBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          key: expect.stringContaining('employee/profile-picture/'),
          buffer: file.buffer,
          contentType: 'image/png',
          cacheControl: 'public, max-age=31536000',
        }),
      );

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { employee_id: 'e1' },
        data: {
          name: 'New',
          avatar_uri: 'employee/profile-picture/abc.jpg',
        },
      });

      expect(res.avatar_uri).toBe('employee/profile-picture/abc.jpg');
    });
  });

  describe('createEmployeeByCompany', () => {
    it('should throw when seat availability exceeded', async () => {
      companyService.getAvailableSeats.mockResolvedValue({
        seat_availability: 0,
      });

      await expect(
        service.createEmployeeByCompany('c1', {
          username: 'u1',
          password: 'p',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw when username already taken', async () => {
      companyService.getAvailableSeats.mockResolvedValue({
        seat_availability: 10,
      });
      prisma.employee.findFirst.mockResolvedValue({ employee_id: 'eX' }); // username exist

      await expect(
        service.createEmployeeByCompany('c1', {
          username: 'u1',
          password: 'p',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should create employee, hash password, and not send email when send_to_email=false', async () => {
      companyService.getAvailableSeats.mockResolvedValue({
        seat_availability: 10,
      });
      prisma.employee.findFirst.mockResolvedValue(null); // username unique

      prisma.employee.create.mockResolvedValue({
        employee_id: 'e1',
        username: 'u1',
        email: 'e@e.com',
        name: 'Emp',
        password: 'hashed:p',
        company: { name: 'Comp', company_identifier: 'CID' },
      });

      const res = await service.createEmployeeByCompany('c1', {
        username: 'u1',
        password: 'p',
        email: 'e@e.com',
        name: 'Emp',
        send_to_email: false,
      } as any);

      expect(prisma.employee.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          username: 'u1',
          password: 'hashed:p',
          company_id: 'c1',
        }),
        include: { company: true },
      });

      expect(mailerService.sendTemplatedEmail).not.toHaveBeenCalled();
      expect(res.employee_id).toBe('e1');
    });

    it('should send email when send_to_email=true', async () => {
      companyService.getAvailableSeats.mockResolvedValue({
        seat_availability: 10,
      });
      prisma.employee.findFirst.mockResolvedValue(null);

      prisma.employee.create.mockResolvedValue({
        employee_id: 'e1',
        username: 'u1',
        email: 'e@e.com',
        name: 'Emp',
        password: 'hashed:p',
        company: { name: 'Comp', company_identifier: 'CID' },
      });

      await service.createEmployeeByCompany('c1', {
        username: 'u1',
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
          employeeUsername: 'u1',
          password: 'p', // plain password dikirim
        }),
      );
    });
  });

  describe('getEmployeesByCompany', () => {
    it('should return employees with selected fields', async () => {
      prisma.employee.findMany.mockResolvedValue([
        { employee_id: 'e1', name: 'Emp 1' },
      ]);

      const res = await service.getEmployeesByCompany('c1');

      expect(prisma.employee.findMany).toHaveBeenCalledWith({
        where: { company_id: 'c1', deleted_at: null },
        select: expect.any(Object),
      });

      expect(res).toEqual([{ employee_id: 'e1', name: 'Emp 1' }]);
    });
  });

  describe('getCountEmployeesByCompany', () => {
    it('should return count', async () => {
      prisma.employee.count.mockResolvedValue(5);

      const res = await service.getCountEmployeesByCompany('c1');

      expect(prisma.employee.count).toHaveBeenCalledWith({
        where: { company_id: 'c1', deleted_at: null },
      });
      expect(res).toBe(5);
    });
  });

  describe('getEmployeeByIdByCompany', () => {
    it('should query employee by company + employee id with select', async () => {
      prisma.employee.findFirst.mockResolvedValue({ employee_id: 'e1' });

      const res = await service.getEmployeeByIdByCompany('c1', 'e1');

      expect(prisma.employee.findFirst).toHaveBeenCalledWith({
        where: { company_id: 'c1', employee_id: 'e1', deleted_at: null },
        select: expect.any(Object),
      });
      expect(res).toEqual({ employee_id: 'e1' });
    });
  });

  describe('updateEmployeeByIdByCompany', () => {
    it('should throw when username already taken by another employee', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        employee_id: 'e-other',
      });

      await expect(
        service.updateEmployeeByIdByCompany('c1', 'e1', {
          username: 'taken',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should hash password when updateData.password provided and update employee', async () => {
      // username check: return same employee -> OK
      prisma.employee.findFirst.mockResolvedValue({ employee_id: 'e1' });

      prisma.employee.update.mockResolvedValue({
        employee_id: 'e1',
        username: 'u1',
        email: 'e@e.com',
        name: 'Emp',
        company: { name: 'Comp', company_identifier: 'CID' },
      });

      const res = await service.updateEmployeeByIdByCompany('c1', 'e1', {
        password: 'newpass',
        send_to_email: false,
      } as any);

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { company_id: 'c1', employee_id: 'e1', deleted_at: null },
        data: expect.objectContaining({
          password: 'hashed:newpass',
        }),
        include: { company: true },
      });

      expect(mailerService.sendTemplatedEmail).not.toHaveBeenCalled();
      expect(res.employee_id).toBe('e1');
    });

    it('should send "send-new-credentials" email when send_to_email=true (and password provided)', async () => {
      prisma.employee.findFirst.mockResolvedValue({ employee_id: 'e1' });

      prisma.employee.update.mockResolvedValue({
        employee_id: 'e1',
        username: 'u1',
        email: 'e@e.com',
        name: 'Emp',
        company: { name: 'Comp', company_identifier: 'CID' },
      });

      await service.updateEmployeeByIdByCompany('c1', 'e1', {
        password: 'newpass',
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
          employeeUsername: 'u1',
          password: 'newpass', // plain password dikirim
        }),
      );
    });

    it('should send "send-updated-data-user" email when send_to_email=true and only password changed (no username)', async () => {
      prisma.employee.findFirst.mockResolvedValue({ employee_id: 'e1' });

      prisma.employee.update.mockResolvedValue({
        employee_id: 'e1',
        username: 'u1',
        email: 'e@e.com',
        name: 'Emp',
        company: { name: 'Comp', company_identifier: 'CID' },
      });

      await service.updateEmployeeByIdByCompany('c1', 'e1', {
        password: 'newpass',
        send_to_email: true,
      } as any);

      // NOTE: di logic kamu, cabang "send-updated-data-user" terjadi kalau:
      // plainPassword !== undefined && !updateData.username
      // tapi kamu masih kirim template "send-updated-data-user" kalau password changed & username tidak berubah.
      // Sesuai implementasi kamu yang sekarang, justru ia akan masuk "send-updated-data-user".
      // Kalau ternyata kamu menginginkan behavior beda, ubah testnya sesuai.

      // Kalau implementasi kamu benar-benar memakai send-updated-data-user, ubah assert ini:
      // expect(mailerService.sendTemplatedEmail).toHaveBeenCalledWith(
      //   'e@e.com',
      //   'Pemberitahuan Penggantian Data Pengguna',
      //   'send-updated-data-user',
      //   expect.any(Object),
      // );

      // Tapi dari code yang kamu kirim, dengan password & send_to_email=true & username tidak ada,
      // ia memang memilih send-updated-data-user.
      expect(mailerService.sendTemplatedEmail).toHaveBeenCalledWith(
        'e@e.com',
        'Pemberitahuan Penggantian Data Pengguna',
        'send-updated-data-user',
        expect.any(Object),
      );
    });
  });

  describe('deleteEmployeeByIdByCompany', () => {
    it('should soft delete employee', async () => {
      prisma.employee.update.mockResolvedValue({ employee_id: 'e1' });

      const res = await service.deleteEmployeeByIdByCompany('c1', 'e1');

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { company_id: 'c1', employee_id: 'e1', deleted_at: null },
        data: { deleted_at: expect.any(Date) },
      });

      expect(res).toEqual({ employee_id: 'e1' });
    });
  });

  describe('getEmployeeById', () => {
    it('should find employee by id', async () => {
      prisma.employee.findFirst.mockResolvedValue({ employee_id: 'e1' });

      const res = await service.getEmployeeById('e1');

      expect(prisma.employee.findFirst).toHaveBeenCalledWith({
        where: { employee_id: 'e1', deleted_at: null },
      });
      expect(res).toEqual({ employee_id: 'e1' });
    });
  });

  describe('getEmployeeByIdIncludeCompany', () => {
    it('should find employee include company', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        employee_id: 'e1',
        company: {},
      });

      const res = await service.getEmployeeByIdIncludeCompany('e1');

      expect(prisma.employee.findFirst).toHaveBeenCalledWith({
        where: { employee_id: 'e1', deleted_at: null },
        include: { company: true },
      });
      expect(res).toEqual({ employee_id: 'e1', company: {} });
    });
  });

  describe('getEmployeeByUsernameByCompany', () => {
    it('should find employee by username and company', async () => {
      prisma.employee.findFirst.mockResolvedValue({ employee_id: 'e1' });

      const res = await service.getEmployeeByUsernameByCompany('u1', 'c1');

      expect(prisma.employee.findFirst).toHaveBeenCalledWith({
        where: { username: 'u1', company_id: 'c1', deleted_at: null },
      });
      expect(res).toEqual({ employee_id: 'e1' });
    });
  });
});
