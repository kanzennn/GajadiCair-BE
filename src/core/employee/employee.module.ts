import { Module } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { CustomMailerModule } from 'src/common/services/mailer/mailer.module';

@Module({
  imports: [CustomMailerModule],
  controllers: [EmployeeController],
  providers: [EmployeeService, PrismaService],
  exports: [EmployeeService],
})
export class EmployeeModule {}
