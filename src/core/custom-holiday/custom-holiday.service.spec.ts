/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// custom-holiday.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';

import { CustomHolidayService } from './custom-holiday.service';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { CompanyService } from '../company/company.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

describe('CustomHolidayService', () => {
  let service: CustomHolidayService;

  // ======= Mocks =======
  const prisma = {
    companyCustomHoliday: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const companyService = {
    getCompanyById: jest.fn(),
  };

  // helper: set system time
  const setNow = (iso: string) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(iso));
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomHolidayService,
        { provide: PrismaService, useValue: prisma },
        { provide: CompanyService, useValue: companyService },
      ],
    }).compile();

    service = module.get(CustomHolidayService);
  });

  describe('createByCompany', () => {
    it('should throw when company not found', async () => {
      setNow('2025-12-29T00:00:00.000Z');
      companyService.getCompanyById.mockResolvedValue(null);

      await expect(
        service.createByCompany('c1', {
          start_date: '2025-12-30',
          end_date: '2025-12-31',
          description: 'Libur',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw when start_date > end_date', async () => {
      setNow('2025-12-29T00:00:00.000Z');
      companyService.getCompanyById.mockResolvedValue({ company_id: 'c1' });

      await expect(
        service.createByCompany('c1', {
          start_date: '2025-12-31',
          end_date: '2025-12-30',
          description: 'Libur',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw when start/end in the past', async () => {
      setNow('2025-12-29T00:00:00.000Z');
      companyService.getCompanyById.mockResolvedValue({ company_id: 'c1' });

      await expect(
        service.createByCompany('c1', {
          start_date: '2025-12-28',
          end_date: '2025-12-29',
          description: 'Libur',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should create holiday when valid', async () => {
      setNow('2025-12-29T00:00:00.000Z');
      companyService.getCompanyById.mockResolvedValue({ company_id: 'c1' });

      prisma.companyCustomHoliday.create.mockResolvedValue({
        company_custom_holiday_id: 'h1',
      });

      const dto = {
        start_date: '2025-12-30',
        end_date: '2025-12-31',
        description: '  Libur Nataru  ',
      } as any;

      const res = await service.createByCompany('c1', dto);

      expect(prisma.companyCustomHoliday.create).toHaveBeenCalled();
      const args = prisma.companyCustomHoliday.create.mock.calls[0][0];

      expect(args.data.company_id).toBe('c1');
      expect(args.data.description).toBe('Libur Nataru');
      expect(args.data.start_date).toBeInstanceOf(Date);
      expect(args.data.end_date).toBeInstanceOf(Date);

      expect(res).toEqual({ company_custom_holiday_id: 'h1' });
    });
  });

  describe('findAllByCompany', () => {
    it('should return list', async () => {
      prisma.companyCustomHoliday.findMany.mockResolvedValue([{ id: 'h1' }]);

      const res = await service.findAllByCompany('c1');

      expect(prisma.companyCustomHoliday.findMany).toHaveBeenCalledWith({
        where: { company_id: 'c1', deleted_at: null },
        orderBy: { start_date: 'asc' },
      });
      expect(res).toEqual([{ id: 'h1' }]);
    });
  });

  describe('findOneById', () => {
    it('should call findUnique', async () => {
      prisma.companyCustomHoliday.findUnique.mockResolvedValue({ id: 'h1' });

      const res = await service.findOneById('h1');

      expect(prisma.companyCustomHoliday.findUnique).toHaveBeenCalledWith({
        where: { company_custom_holiday_id: 'h1' },
      });
      expect(res).toEqual({ id: 'h1' });
    });
  });

  describe('findOneByIdByCompany', () => {
    it('should throw when not found', async () => {
      prisma.companyCustomHoliday.findFirst.mockResolvedValue(null);

      await expect(
        service.findOneByIdByCompany('c1', 'h1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should return data when found', async () => {
      prisma.companyCustomHoliday.findFirst.mockResolvedValue({ id: 'h1' });

      const res = await service.findOneByIdByCompany('c1', 'h1');

      expect(prisma.companyCustomHoliday.findFirst).toHaveBeenCalledWith({
        where: {
          company_custom_holiday_id: 'h1',
          company_id: 'c1',
          deleted_at: null,
        },
      });
      expect(res).toEqual({ id: 'h1' });
    });
  });

  describe('updateByCompany', () => {
    it('should throw when company not found', async () => {
      setNow('2025-12-29T00:00:00.000Z');
      companyService.getCompanyById.mockResolvedValue(null);

      await expect(
        service.updateByCompany('c1', 'h1', {
          start_date: '2025-12-30',
          end_date: '2025-12-31',
          description: 'x',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw when holiday not found', async () => {
      setNow('2025-12-29T00:00:00.000Z');
      companyService.getCompanyById.mockResolvedValue({ company_id: 'c1' });
      prisma.companyCustomHoliday.findFirst.mockResolvedValue(null);

      await expect(
        service.updateByCompany('c1', 'h1', {
          start_date: '2025-12-30',
          end_date: '2025-12-31',
          description: 'x',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw when holiday already started (start_date today/past)', async () => {
      setNow('2025-12-29T00:00:00.000Z');
      companyService.getCompanyById.mockResolvedValue({ company_id: 'c1' });

      prisma.companyCustomHoliday.findFirst.mockResolvedValue({
        company_custom_holiday_id: 'h1',
        company_id: 'c1',
        start_date: new Date('2025-12-29T00:00:00.000Z'), // today
        end_date: new Date('2025-12-30T00:00:00.000Z'),
        description: 'x',
      });

      await expect(
        service.updateByCompany('c1', 'h1', {
          start_date: '2025-12-30',
          end_date: '2025-12-31',
          description: 'y',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should update when valid and not started yet', async () => {
      setNow('2025-12-29T00:00:00.000Z');
      companyService.getCompanyById.mockResolvedValue({ company_id: 'c1' });

      prisma.companyCustomHoliday.findFirst.mockResolvedValue({
        company_custom_holiday_id: 'h1',
        company_id: 'c1',
        start_date: new Date('2025-12-31T00:00:00.000Z'), // future
        end_date: new Date('2026-01-01T00:00:00.000Z'),
        description: 'x',
      });

      prisma.companyCustomHoliday.update.mockResolvedValue({ id: 'h1' });

      const res = await service.updateByCompany('c1', 'h1', {
        start_date: '2026-01-02',
        end_date: '2026-01-03',
        description: '  Update  ',
      } as any);

      expect(prisma.companyCustomHoliday.update).toHaveBeenCalled();
      const args = prisma.companyCustomHoliday.update.mock.calls[0][0];

      expect(args.where).toEqual({ company_custom_holiday_id: 'h1' });
      expect(args.data.description).toBe('Update');
      expect(args.data.start_date).toBeInstanceOf(Date);
      expect(args.data.end_date).toBeInstanceOf(Date);

      expect(res).toEqual({ id: 'h1' });
    });
  });

  describe('removeByCompany', () => {
    it('should throw when company not found', async () => {
      setNow('2025-12-29T00:00:00.000Z');
      companyService.getCompanyById.mockResolvedValue(null);

      await expect(service.removeByCompany('c1', 'h1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should throw when holiday not found', async () => {
      setNow('2025-12-29T00:00:00.000Z');
      companyService.getCompanyById.mockResolvedValue({ company_id: 'c1' });
      prisma.companyCustomHoliday.findFirst.mockResolvedValue(null);

      await expect(service.removeByCompany('c1', 'h1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should throw when holiday already started (start_date today/past)', async () => {
      setNow('2025-12-29T00:00:00.000Z');
      companyService.getCompanyById.mockResolvedValue({ company_id: 'c1' });

      prisma.companyCustomHoliday.findFirst.mockResolvedValue({
        company_custom_holiday_id: 'h1',
        company_id: 'c1',
        start_date: new Date('2025-12-29T00:00:00.000Z'),
        end_date: new Date('2025-12-30T00:00:00.000Z'),
        description: 'x',
      });

      await expect(service.removeByCompany('c1', 'h1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should soft delete when valid and not started yet', async () => {
      setNow('2025-12-29T00:00:00.000Z');
      companyService.getCompanyById.mockResolvedValue({ company_id: 'c1' });

      prisma.companyCustomHoliday.findFirst.mockResolvedValue({
        company_custom_holiday_id: 'h1',
        company_id: 'c1',
        start_date: new Date('2025-12-31T00:00:00.000Z'),
        end_date: new Date('2026-01-01T00:00:00.000Z'),
        description: 'x',
      });

      prisma.companyCustomHoliday.update.mockResolvedValue({
        id: 'h1',
        deleted_at: new Date(),
      });

      const res = await service.removeByCompany('c1', 'h1');

      expect(prisma.companyCustomHoliday.update).toHaveBeenCalledWith({
        where: { company_custom_holiday_id: 'h1' },
        data: { deleted_at: expect.any(Date) },
      });

      expect(res).toMatchObject({ id: 'h1' });
    });
  });
});
