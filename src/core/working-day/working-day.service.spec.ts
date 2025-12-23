import { Test, TestingModule } from '@nestjs/testing';
import { WorkingDayService } from './working-day.service';

describe('WorkingDayService', () => {
  let service: WorkingDayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkingDayService],
    }).compile();

    service = module.get<WorkingDayService>(WorkingDayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
