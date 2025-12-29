import { Test, TestingModule } from '@nestjs/testing';

import { WorkingDayController } from './working-day.controller';
import { WorkingDayService } from './working-day.service';

import { successResponse } from 'src/utils/response.utils';

jest.mock('src/utils/response.utils', () => ({
  successResponse: jest.fn(
    (data: any, message: string, statusCode?: number) => ({
      statusCode: statusCode ?? 200,
      message,
      data,
    }),
  ),
}));

describe('WorkingDayController', () => {
  let controller: WorkingDayController;

  const workingDayService = {
    get: jest.fn(),
    update: jest.fn(),
  };

  const req = {
    user: { sub: 'c1' },
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkingDayController],
      providers: [{ provide: WorkingDayService, useValue: workingDayService }],
    }).compile();

    controller = module.get(WorkingDayController);
  });

  describe('getWorkingDay', () => {
    it('should return working day data wrapped by successResponse', async () => {
      workingDayService.get.mockResolvedValue({
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
      });

      const res = await controller.getWorkingDay(req);

      expect(workingDayService.get).toHaveBeenCalledWith('c1');
      expect(successResponse).toHaveBeenCalledWith(
        {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: false,
          sunday: false,
        },
        'Working day fetched successfully',
      );

      expect(res).toEqual({
        statusCode: 200,
        message: 'Working day fetched successfully',
        data: {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: false,
          sunday: false,
        },
      });
    });
  });

  describe('updateWorkingDay', () => {
    it('should update working day and return successResponse', async () => {
      const dto = {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: false,
      } as any;

      workingDayService.update.mockResolvedValue(dto);

      const res = await controller.updateWorkingDay(req, dto);

      expect(workingDayService.update).toHaveBeenCalledWith('c1', dto);
      expect(successResponse).toHaveBeenCalledWith(
        dto,
        'Working day updated successfully',
      );

      expect(res).toEqual({
        statusCode: 200,
        message: 'Working day updated successfully',
        data: dto,
      });
    });
  });
});
