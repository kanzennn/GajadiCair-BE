/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { GoogleOauthService } from 'src/common/services/google/google-oauth.service';
import { JwtService } from '@nestjs/jwt';
import { S3Service } from 'src/common/services/s3/s3.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { PrismaService } from 'src/common/services/prisma/prisma.service';

// ✅ Mock argon2 (hash/verify) biar test stabil (nggak hit DB beneran)
jest.mock('argon2', () => ({
  hash: jest.fn((v: string) => `hashed:${v}`),
  verify: jest.fn((_hashed: string, plain: string) => plain === 'correct'),
}));

describe('AuthService', () => {
  let service: AuthService;

  // ======= Mocks =======
  const prisma = {
    company: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    employee: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    companySocialite: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    companyWorkingDay: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const googleOauthService = {
    verifyToken: jest.fn(),
  };

  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const s3Service = {
    uploadBuffer: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: GoogleOauthService, useValue: googleOauthService },
        { provide: JwtService, useValue: jwtService },
        { provide: S3Service, useValue: s3Service },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('loginCompany', () => {
    it('should login company and return tokens', async () => {
      prisma.company.findFirst.mockResolvedValue({
        company_id: 'c1',
        email: 'a@a.com',
        password: 'hashed:any',
      });

      prisma.company.update.mockResolvedValue({});

      jwtService.signAsync
        .mockResolvedValueOnce('access_token') // access
        .mockResolvedValueOnce('refresh_token'); // refresh

      const res = await service.loginCompany({
        email: 'a@a.com',
        password: 'correct',
      });
      console.log(res);

      expect(prisma.company.findFirst).toHaveBeenCalledWith({
        where: { email: 'a@a.com' },
      });
      expect(prisma.company.update).toHaveBeenCalled();
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);

      expect(res).toEqual({
        company: { company_id: 'c1', email: 'a@a.com', password: undefined },
        access_token: 'access_token',
        refresh_token: 'refresh_token',
      });
    });

    it('should throw invalid credentials when company not found / no password', async () => {
      prisma.company.findFirst.mockResolvedValue(null);

      await expect(
        service.loginCompany({ email: 'x@x.com', password: 'correct' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw invalid credentials when password wrong', async () => {
      prisma.company.findFirst.mockResolvedValue({
        company_id: 'c1',
        email: 'a@a.com',
        password: 'hashed:any',
      });

      await expect(
        service.loginCompany({ email: 'a@a.com', password: 'wrong' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('registerCompany', () => {
    it('should throw when email already in use', async () => {
      prisma.company.findFirst.mockResolvedValue({ company_id: 'c1' });

      await expect(
        service.registerCompany({
          email: 'a@a.com',
          name: 'A',
          password: 'p',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should create company, default working day, and return tokens', async () => {
      prisma.company.findFirst.mockResolvedValueOnce(null); // existing company by email
      // generateUniqueCompanyIdentifier loop: check identifier uniqueness
      prisma.company.findFirst.mockResolvedValueOnce(null); // identifier unique

      prisma.company.create.mockResolvedValue({
        company_id: 'c1',
        email: 'a@a.com',
        name: 'A',
        password: 'hashed:p',
        company_identifier: '1111-111-111',
      });

      prisma.companyWorkingDay.findFirst.mockResolvedValue(null);
      prisma.companyWorkingDay.create.mockResolvedValue({});

      jwtService.signAsync
        .mockResolvedValueOnce('access_token')
        .mockResolvedValueOnce('refresh_token');

      const res = await service.registerCompany({
        email: 'a@a.com',
        name: 'A',
        password: 'p',
      } as any);

      expect(prisma.company.create).toHaveBeenCalled();
      expect(prisma.companyWorkingDay.create).toHaveBeenCalled();
      expect(res.company.password).toBeUndefined();
      expect(res.access_token).toBe('access_token');
      expect(res.refresh_token).toBe('refresh_token');
    });
  });

  describe('changeCompanyPassword', () => {
    it('should throw when company not found', async () => {
      prisma.company.findFirst.mockResolvedValue({
        company_id: 'c1',
        deleted_at: null,
      });

      await expect(
        service.changeCompanyPassword('c1', 'correct', 'new'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw when company is social login (no password)', async () => {
      prisma.company.findFirst.mockResolvedValue({
        company_id: 'c1',
        password: null,
        deleted_at: null,
      });

      await expect(
        service.changeCompanyPassword('c1', 'correct', 'new'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw when old password is incorrect', async () => {
      prisma.company.findFirst.mockResolvedValue({
        company_id: 'c1',
        password: 'hashed:any',
        deleted_at: null,
      });

      await expect(
        service.changeCompanyPassword('c1', 'wrong', 'new'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should update password when old password valid', async () => {
      prisma.company.findFirst.mockResolvedValue({
        company_id: 'c1',
        password: 'hashed:any',
        deleted_at: null,
      });

      prisma.company.update.mockResolvedValue({});

      const res = await service.changeCompanyPassword('c1', 'correct', 'new');

      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { company_id: 'c1' },
        data: { password: 'hashed:new' },
      });
      expect(res).toEqual({ success: true });
    });
  });

  describe('refreshCompanyToken', () => {
    it('should throw invalid refresh token when role mismatch', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'c1',
        email: 'a@a.com',
        role: 'employee',
        type: 'refresh',
      });

      await expect(service.refreshCompanyToken('rt')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should return new access token when valid', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'c1',
        email: 'a@a.com',
        role: 'company',
        type: 'refresh',
      });

      jwtService.signAsync.mockResolvedValue('new_access');

      const res = await service.refreshCompanyToken('rt');

      expect(res).toEqual({ access_token: 'new_access' });
    });
  });

  describe('loginEmployee', () => {
    it('should login employee and return tokens', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        employee_id: 'e1',
        email: 'e@e.com',
        username: 'emp',
        password: 'hashed:any',
        is_active: true,
        company: { company_identifier: 'CID' },
      });

      prisma.employee.update.mockResolvedValue({});

      jwtService.signAsync
        .mockResolvedValueOnce('access_token')
        .mockResolvedValueOnce('refresh_token');

      const res = await service.loginEmployee({
        username: 'emp',
        password: 'correct',
        company_identifier: 'CID',
      });

      expect(res.employee.password).toBeUndefined();
      expect(res.access_token).toBe('access_token');
      expect(res.refresh_token).toBe('refresh_token');
    });

    it('should throw invalid credentials if inactive/identifier mismatch', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        employee_id: 'e1',
        email: 'e@e.com',
        username: 'emp',
        password: 'hashed:any',
        is_active: false,
        company: { company_identifier: 'CID' },
      });

      await expect(
        service.loginEmployee({
          username: 'emp',
          password: 'correct',
          company_identifier: 'CID',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('changeEmployeePassword', () => {
    it('should throw when employee not found', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.changeEmployeePassword('e1', 'correct', 'new'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw when old password is incorrect', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        employee_id: 'e1',
        password: 'hashed:any',
        deleted_at: null,
      });

      await expect(
        service.changeEmployeePassword('e1', 'wrong', 'new'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should update password when old password valid', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        employee_id: 'e1',
        password: 'hashed:any',
        deleted_at: null,
      });

      prisma.employee.update.mockResolvedValue({});

      const res = await service.changeEmployeePassword('e1', 'correct', 'new');

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { employee_id: 'e1' },
        data: { password: 'hashed:new' },
      });
      expect(res).toEqual({ success: true });
    });
  });

  describe('googleLoginCompany', () => {
    beforeEach(() => {
      // mock fetch used by downloadImageToBuffer

      (globalThis as any).fetch = jest.fn(() => ({
        ok: true,
        headers: { get: () => 'image/jpeg' },
        arrayBuffer: () => new ArrayBuffer(8),
      }));
    });

    it('should login via google using existing socialite record', async () => {
      googleOauthService.verifyToken.mockResolvedValue({
        sub: 'google-1',
        email: 'a@a.com',
        name: 'A',
        picture: null,
      });

      prisma.companySocialite.findFirst.mockResolvedValue({
        company: { company_id: 'c1', email: 'a@a.com', password: null },
      });

      prisma.company.update.mockResolvedValue({});

      jwtService.signAsync
        .mockResolvedValueOnce('access_token')
        .mockResolvedValueOnce('refresh_token');

      const res = await service.googleLoginCompany('idToken');

      expect(res.company.password).toBeUndefined();
      expect(res.access_token).toBe('access_token');
      expect(res.refresh_token).toBe('refresh_token');
    });

    it('should create company + socialite record when not exists (with picture upload)', async () => {
      googleOauthService.verifyToken.mockResolvedValue({
        sub: 'google-1',
        email: 'a@a.com',
        name: 'A',
        picture: 'https://pic',
      });

      prisma.companySocialite.findFirst.mockResolvedValue(null);
      prisma.company.findFirst
        .mockResolvedValueOnce(null) // find company by email
        .mockResolvedValueOnce(null); // identifier unique loop

      prisma.company.create.mockResolvedValue({
        company_id: 'c1',
        email: 'a@a.com',
        name: 'A',
        avatar_uri: null,
        company_identifier: '1111-111-111',
      });

      prisma.companyWorkingDay.findFirst.mockResolvedValue(null);
      prisma.companyWorkingDay.create.mockResolvedValue({});

      s3Service.uploadBuffer.mockResolvedValue({ url: 'https://s3/url' });

      prisma.company.update
        .mockResolvedValueOnce({
          company_id: 'c1',
          email: 'a@a.com',
          name: 'A',
          avatar_uri: 'https://s3/url',
          company_identifier: '1111-111-111',
        }) // avatar update
        .mockResolvedValueOnce({}); // last_login update

      prisma.companySocialite.create.mockResolvedValue({
        company: {
          company_id: 'c1',
          email: 'a@a.com',
          password: null,
        },
      });

      jwtService.signAsync
        .mockResolvedValueOnce('access_token')
        .mockResolvedValueOnce('refresh_token');

      const res = await service.googleLoginCompany('idToken');

      expect(s3Service.uploadBuffer).toHaveBeenCalled();
      expect(prisma.companySocialite.create).toHaveBeenCalled();
      expect(res.access_token).toBe('access_token');
      expect(res.refresh_token).toBe('refresh_token');
    });
  });
});
