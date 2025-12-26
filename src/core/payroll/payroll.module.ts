import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { CustomMailerModule } from 'src/common/services/mailer/mailer.module';

@Module({
  imports: [CustomMailerModule],
  controllers: [PayrollController],
  providers: [PayrollService, PrismaService],
  exports: [PayrollService], // ⬅️ PENTING
})
export class PayrollModule {}
