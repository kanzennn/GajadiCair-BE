/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as midtransClient from 'midtrans-client';

@Injectable()
export class MidtransService {
  private snap: midtransClient.Snap;

  constructor(private configService: ConfigService) {
    this.snap = new midtransClient.Snap({
      isProduction: this.configService.get<boolean>('MIDTRANS_IS_PRODUCTION'),
      serverKey: this.configService.get<string>('MIDTRANS_SERVER_KEY'),
      clientKey: this.configService.get<string>('MIDTRANS_CLIENT_KEY'),
    });
  }

  async createTransaction(
    params: midtransClient.Snap.SnapTransactionRequestType,
  ) {
    return this.snap.createTransaction(params);
  }
}
