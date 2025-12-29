// src/jobs/jobs.module.ts
import { Module } from '@nestjs/common';
import { AttendanceJobService } from './attendance.job';
import { PayrollJobService } from './payroll.job';

import { AttendanceModule } from 'src/core/attendance/attendance.module';
import { PayrollModule } from 'src/core/payroll/payroll.module';
import { CustomMailerModule } from 'src/common/services/mailer/mailer.module';
import { PrismaService } from 'src/common/services/prisma/prisma.service';

@Module({
  imports: [
    AttendanceModule, // ✅ butuh AttendanceService
    PayrollModule, // ✅ butuh PayrollService
    CustomMailerModule, // ✅ kirim email payroll
  ],
  providers: [AttendanceJobService, PayrollJobService, PrismaService],
})
export class JobsModule {}
