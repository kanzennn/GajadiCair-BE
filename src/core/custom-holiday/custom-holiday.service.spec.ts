import { Test, TestingModule } from '@nestjs/testing';
import { CustomHolidayService } from './custom-holiday.service';

describe('CustomHolidayService', () => {
  let service: CustomHolidayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomHolidayService],
    }).compile();

    service = module.get<CustomHolidayService>(CustomHolidayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
