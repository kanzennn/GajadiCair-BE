import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MidtransService } from './midtrans.service';

@Module({
  imports: [ConfigModule],
  providers: [MidtransService],
  exports: [MidtransService],
})
export class MidtransModule {}
