import { Module } from '@nestjs/common';
import { CustomHolidayService } from './custom-holiday.service';
import { CustomHolidayController } from './custom-holiday.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { CompanyService } from '../company/company.service';

@Module({
  controllers: [CustomHolidayController],
  providers: [CustomHolidayService, PrismaService, CompanyService],
})
export class CustomHolidayModule {}
