import { Test, TestingModule } from '@nestjs/testing';
import { WorkingDayController } from './working-day.controller';
import { WorkingDayService } from './working-day.service';

describe('WorkingDayController', () => {
  let controller: WorkingDayController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkingDayController],
      providers: [WorkingDayService],
    }).compile();

    controller = module.get<WorkingDayController>(WorkingDayController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
