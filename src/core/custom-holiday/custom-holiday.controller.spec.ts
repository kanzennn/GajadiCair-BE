import { Test, TestingModule } from '@nestjs/testing';

import { CustomHolidayController } from './custom-holiday.controller';
import { CustomHolidayService } from './custom-holiday.service';

describe('CustomHolidayController', () => {
  let controller: CustomHolidayController;

  const customHolidayService = {
    createByCompany: jest.fn(),
    findAllByCompany: jest.fn(),
    findOneByIdByCompany: jest.fn(),
    updateByCompany: jest.fn(),
    removeByCompany: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomHolidayController],
      providers: [
        { provide: CustomHolidayService, useValue: customHolidayService },
      ],
    }).compile();

    controller = module.get(CustomHolidayController);
  });

  const req = (companyId = 'c1') =>
    ({
      user: { sub: companyId, role: 'company', type: 'access' },
    }) as any;

  describe('create', () => {
    it('should call service.createByCompany and return successResponse', async () => {
      customHolidayService.createByCompany.mockResolvedValue({ id: 'h1' });

      const res = await controller.create(req('c1'), {
        start_date: '2025-12-30',
        end_date: '2025-12-31',
        description: 'Libur',
      } as any);

      expect(customHolidayService.createByCompany).toHaveBeenCalledWith(
        'c1',
        expect.any(Object),
      );
      expect(res.statusCode).toBe(201);
      expect(res.message).toBe('Custom holiday created successfully');
      expect(res.data).toEqual({ id: 'h1' });
    });
  });

  describe('findAll', () => {
    it('should call service.findAllByCompany and return successResponse', async () => {
      customHolidayService.findAllByCompany.mockResolvedValue([{ id: 'h1' }]);

      const res = await controller.findAll(req('c1'));

      expect(customHolidayService.findAllByCompany).toHaveBeenCalledWith('c1');
      expect(res.message).toBe('Custom holidays fetched successfully');
      expect(res.data).toEqual([{ id: 'h1' }]);
    });
  });

  describe('findOne', () => {
    it('should call service.findOneByIdByCompany and return successResponse', async () => {
      customHolidayService.findOneByIdByCompany.mockResolvedValue({ id: 'h1' });

      const res = await controller.findOne(req('c1'), 'h1');

      expect(customHolidayService.findOneByIdByCompany).toHaveBeenCalledWith(
        'c1',
        'h1',
      );
      expect(res.message).toBe('Custom holiday fetched successfully');
      expect(res.data).toEqual({ id: 'h1' });
    });
  });

  describe('update', () => {
    it('should call service.updateByCompany and return successResponse', async () => {
      customHolidayService.updateByCompany.mockResolvedValue({
        id: 'h1',
        description: 'Updated',
      });

      const res = await controller.update(req('c1'), 'h1', {
        start_date: '2026-01-02',
        end_date: '2026-01-03',
        description: 'Updated',
      } as any);

      expect(customHolidayService.updateByCompany).toHaveBeenCalledWith(
        'c1',
        'h1',
        expect.any(Object),
      );
      expect(res.message).toBe('Custom holiday updated successfully');
      expect(res.data).toEqual({ id: 'h1', description: 'Updated' });
    });
  });

  describe('remove', () => {
    it('should call service.removeByCompany and return successResponse', async () => {
      customHolidayService.removeByCompany.mockResolvedValue({
        id: 'h1',
        deleted_at: new Date(),
      });

      const res = await controller.remove(req('c1'), 'h1');

      expect(customHolidayService.removeByCompany).toHaveBeenCalledWith(
        'c1',
        'h1',
      );
      expect(res.message).toBe('Custom holiday removed successfully');
      expect(res.data).toEqual({ id: 'h1', deleted_at: expect.any(Date) });
    });
  });
});
