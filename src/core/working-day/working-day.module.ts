import { Module } from '@nestjs/common';
import { WorkingDayService } from './working-day.service';
import { WorkingDayController } from './working-day.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';

@Module({
  controllers: [WorkingDayController],
  providers: [WorkingDayService, PrismaService],
})
export class WorkingDayModule {}
