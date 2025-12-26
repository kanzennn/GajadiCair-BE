// custom-holiday.module.ts
import { Module } from '@nestjs/common';
import { CustomHolidayService } from './custom-holiday.service';
import { CustomHolidayController } from './custom-holiday.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { CompanyModule } from '../company/company.module';

@Module({
  imports: [CompanyModule],
  controllers: [CustomHolidayController],
  providers: [CustomHolidayService, PrismaService],
})
export class CustomHolidayModule {}
