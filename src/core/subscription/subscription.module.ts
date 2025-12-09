// subscription.module.ts
import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { MidtransModule } from 'src/common/services/midtrans/midtrans.module';
import { CompanyService } from '../company/company.service';

@Module({
  imports: [MidtransModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, PrismaService, CompanyService],
})
export class SubscriptionModule {}
