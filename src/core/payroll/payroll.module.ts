import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { PayrollJobService } from 'src/jobs/payroll.job';

@Module({
  controllers: [PayrollController],
  providers: [PayrollService, PrismaService, PayrollJobService],
})
export class PayrollModule {}
