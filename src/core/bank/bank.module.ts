import { Module } from '@nestjs/common';
import { BankService } from './bank.service';
import { BankController } from './bank.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';

@Module({
  controllers: [BankController],
  providers: [BankService, PrismaService],
  exports: [BankService],
})
export class BankModule {}
