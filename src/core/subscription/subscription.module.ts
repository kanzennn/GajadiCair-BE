// subscription.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { MidtransModule } from 'src/common/services/midtrans/midtrans.module';
import { CompanyModule } from '../company/company.module';

@Module({
  imports: [MidtransModule, forwardRef(() => CompanyModule)],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, PrismaService],
  exports: [SubscriptionService], // kalau dipakai module lain
})
export class SubscriptionModule {}
