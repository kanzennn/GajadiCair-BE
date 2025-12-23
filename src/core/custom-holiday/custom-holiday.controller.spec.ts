import { Test, TestingModule } from '@nestjs/testing';
import { CustomHolidayController } from './custom-holiday.controller';
import { CustomHolidayService } from './custom-holiday.service';

describe('CustomHolidayController', () => {
  let controller: CustomHolidayController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomHolidayController],
      providers: [CustomHolidayService],
    }).compile();

    controller = module.get<CustomHolidayController>(CustomHolidayController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
