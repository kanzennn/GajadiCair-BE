/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Test, TestingModule } from '@nestjs/testing';
import { CompanyService } from './company.service';

import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { S3Service } from 'src/common/services/s3/s3.service';
import { SubscriptionService } from '../subscription/subscription.service';

import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

// mock convertFilename biar deterministik
jest.mock('src/utils/convertString.utils', () => ({
  convertFilename: jest.fn((v: string) => `safe-${v}`),
}));

describe('CompanyService', () => {
  let service: CompanyService;

  const prisma = {
    company: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    employee: {
      count: jest.fn(),
    },
  };

  const s3 = {
    uploadBuffer: jest.fn(),
  };

  const subscriptionService = {
    getSubscriptionStatus: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyService,
        { provide: PrismaService, useValue: prisma },
        { provide: S3Service, useValue: s3 },
        { provide: SubscriptionService, useValue: subscriptionService },
      ],
    }).compile();

    service = module.get(CompanyService);
  });

  describe('getCompanyById', () => {
    it('should return company by id', async () => {
      prisma.company.findUnique.mockResolvedValue({ company_id: 'c1' });

      const res = await service.getCompanyById('c1');

      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { company_id: 'c1' },
      });
      expect(res).toEqual({ company_id: 'c1' });
    });
  });

  describe('getAvailableSeats', () => {
    it('should throw when company not found', async () => {
      prisma.company.findFirst.mockResolvedValue(null);

      await expect(service.getAvailableSeats('c1')).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(prisma.company.findFirst).toHaveBeenCalledWith({
        where: { company_id: 'c1', deleted_at: null },
        select: { company_id: true },
      });
    });

    it('should return level 0 capacity 5', async () => {
      prisma.company.findFirst.mockResolvedValue({ company_id: 'c1' });
      prisma.employee.count.mockResolvedValue(3);
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
        plan_expiration: null,
      });

      const res = await service.getAvailableSeats('c1');

      expect(res).toEqual({
        seat_taken: 3,
        seat_capacity: 5,
        seat_availability: 2,
      });
    });

    it('should return level 1 capacity 20', async () => {
      prisma.company.findFirst.mockResolvedValue({ company_id: 'c1' });
      prisma.employee.count.mockResolvedValue(7);
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 1,
        plan_expiration: new Date(),
      });

      const res = await service.getAvailableSeats('c1');

      expect(res).toEqual({
        seat_taken: 7,
        seat_capacity: 20,
        seat_availability: 13,
      });
    });

    it('should return level 2 unlimited capacity', async () => {
      prisma.company.findFirst.mockResolvedValue({ company_id: 'c1' });
      prisma.employee.count.mockResolvedValue(999);
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 2,
        plan_expiration: new Date(),
      });

      const res = await service.getAvailableSeats('c1');

      expect(res).toEqual({
        seat_taken: 999,
        seat_capacity: null,
        seat_availability: null,
      });
    });

    it('should not return negative availability (over capacity)', async () => {
      prisma.company.findFirst.mockResolvedValue({ company_id: 'c1' });
      prisma.employee.count.mockResolvedValue(10);
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 0,
        plan_expiration: null,
      });

      const res = await service.getAvailableSeats('c1');

      expect(res).toEqual({
        seat_taken: 10,
        seat_capacity: 5,
        seat_availability: 0,
      });
    });
  });

  describe('updateCompanyProfile', () => {
    it('should throw when company not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.updateCompanyProfile('c1', { name: 'A' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { company_id: 'c1' },
        select: { company_id: true },
      });
    });

    it('should update profile without file', async () => {
      prisma.company.findUnique.mockResolvedValue({ company_id: 'c1' });
      prisma.company.update.mockResolvedValue({
        company_id: 'c1',
        name: 'New',
        avatar_uri: null,
      });

      const dto = { name: 'New' } as any;
      const res = await service.updateCompanyProfile('c1', dto);

      expect(s3.uploadBuffer).not.toHaveBeenCalled();
      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { company_id: 'c1' },
        data: { name: 'New' },
      });
      expect(res.company_id).toBe('c1');
    });

    it('should upload avatar and set avatar_uri when file provided', async () => {
      prisma.company.findUnique.mockResolvedValue({ company_id: 'c1' });
      s3.uploadBuffer.mockResolvedValue({ key: 'company/profile-picture/k1' });

      prisma.company.update.mockResolvedValue({
        company_id: 'c1',
        avatar_uri: 'company/profile-picture/k1',
      });

      const file = {
        originalname: 'My Pic.png',
        mimetype: 'image/png',
        buffer: Buffer.from('x'),
      } as any;

      const dto = { name: 'A' } as any;

      const res = await service.updateCompanyProfile('c1', dto, file);

      expect(s3.uploadBuffer).toHaveBeenCalledWith({
        key: expect.stringMatching(
          /^company\/profile-picture\/\d+-safe-My Pic\.png$/,
        ),
        buffer: file.buffer,
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000',
      });

      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { company_id: 'c1' },
        data: {
          name: 'A',
          avatar_uri: 'company/profile-picture/k1',
        },
      });

      expect(res.avatar_uri).toBe('company/profile-picture/k1');
    });
  });
});
