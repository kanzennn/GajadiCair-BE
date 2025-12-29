import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { WorkingDayService } from './working-day.service';

describe('WorkingDayService', () => {
  let service: WorkingDayService;

  const prisma = {
    companyWorkingDay: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkingDayService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(WorkingDayService);
  });

  describe('get', () => {
    it('should return working days by companyId', async () => {
      prisma.companyWorkingDay.findFirst.mockResolvedValue({
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
      });

      const res = await service.get('c1');

      expect(prisma.companyWorkingDay.findFirst).toHaveBeenCalledWith({
        where: { company_id: 'c1', deleted_at: null },
        select: {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: true,
          sunday: true,
        },
      });

      expect(res).toEqual({
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
      });
    });

    it('should return null if not found', async () => {
      prisma.companyWorkingDay.findFirst.mockResolvedValue(null);

      const res = await service.get('c1');

      expect(prisma.companyWorkingDay.findFirst).toHaveBeenCalled();
      expect(res).toBeNull();
    });
  });

  describe('update', () => {
    const dto = {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    } as any;

    it('should create when working day not exists', async () => {
      prisma.companyWorkingDay.findFirst.mockResolvedValue(null);

      prisma.companyWorkingDay.create.mockResolvedValue({
        ...dto,
      });

      const res = await service.update('c1', dto);

      expect(prisma.companyWorkingDay.findFirst).toHaveBeenCalledWith({
        where: { company_id: 'c1', deleted_at: null },
        select: { company_working_day_id: true },
      });

      expect(prisma.companyWorkingDay.create).toHaveBeenCalledWith({
        data: { company_id: 'c1', ...dto },
        select: {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: true,
          sunday: true,
        },
      });

      expect(prisma.companyWorkingDay.update).not.toHaveBeenCalled();
      expect(res).toEqual(dto);
    });

    it('should update when working day exists', async () => {
      prisma.companyWorkingDay.findFirst.mockResolvedValue({
        company_working_day_id: 'wd1',
      });

      prisma.companyWorkingDay.update.mockResolvedValue({
        ...dto,
        saturday: true,
      });

      const res = await service.update('c1', dto);

      expect(prisma.companyWorkingDay.findFirst).toHaveBeenCalledWith({
        where: { company_id: 'c1', deleted_at: null },
        select: { company_working_day_id: true },
      });

      expect(prisma.companyWorkingDay.update).toHaveBeenCalledWith({
        where: { company_working_day_id: 'wd1' },
        data: { ...dto },
        select: {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: true,
          sunday: true,
        },
      });

      expect(prisma.companyWorkingDay.create).not.toHaveBeenCalled();
      expect(res).toEqual({ ...dto, saturday: true });
    });
  });
});
