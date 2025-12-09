/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateSnapSubscriptionDto } from './dto/create-snap-subscription.dto';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { CompanyService } from '../company/company.service';
import { MidtransService } from 'src/common/services/midtrans/midtrans.service';
import { InternalServerErrorException } from 'src/common/exceptions/internalServerError.exception';
import { SnapDto } from 'src/common/services/midtrans/dto/snap.dto';
import crypto from 'crypto';

import { ConfigService } from '@nestjs/config';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly midtransService: MidtransService,
    private readonly prisma: PrismaService,
    private readonly companyService: CompanyService,
    private readonly configService: ConfigService,
  ) {}

  async createSnap(
    createSnapSubscriptionDto: CreateSnapSubscriptionDto,
    user: TokenPayloadDto,
  ) {
    const companyProfile = await this.companyService.getCompanyById(user.sub);

    let gross_amount = 100000;
    let plan = 1;

    switch (createSnapSubscriptionDto.level_plan) {
      case 1:
        plan = 1;
        gross_amount = 100000;
        break;
      case 2:
        plan = 2;
        gross_amount = 250000;
        break;
      default:
        plan = 1;
        gross_amount = 100000;
    }

    const order_id = `sub${plan}-${Date.now()}`;

    const params = {
      transaction_details: {
        order_id: order_id,
        gross_amount,
      },
      customer_details: {
        first_name: `${companyProfile?.name}`,
        email: companyProfile?.email,
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result: SnapDto = await this.midtransService
      .createTransaction(params)
      .catch((error) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        console.error('Midtrans Error:', error.ApiResponse);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (error.ApiResponse) {
          throw new InternalServerErrorException(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            `Midtrans API Error: ${error.ApiResponse.error_messages[0]}`,
          );
        }

        throw new InternalServerErrorException(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `Midtrans Unexpected Error: ${error.message}`,
        );
      });

    const subscription =
      await this.prisma.companySubscriptionTransactionHistory.create({
        data: {
          company_subscription_id: order_id,
          company_id: user.sub,
          gross_amount: gross_amount,
          midtrans_redirect_url: result.redirect_url,
          midtrans_transaction_token: result.token,
          level_plan: plan,
          plan_duration_months: 1,
        },
      });

    if (!subscription) {
      throw new InternalServerErrorException(
        'Failed to create subscription transaction record',
      );
    }

    return result;
  }

  async getSubscriptionTransactionHistoriesByCompany(company_id: string) {
    return await this.prisma.companySubscriptionTransactionHistory.findMany({
      where: { company_id },
      orderBy: { created_at: 'desc' },
    });
  }

  async handleMidtransWebhook(payload: any) {
    const serverKey = this.configService.get<string>('MIDTRANS_SERVER_KEY');

    const hash = crypto
      .createHash('sha512')
      .update(
        `${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey}`,
      )
      .digest('hex');

    if (hash !== payload.signature_key) {
      throw new BadRequestException('Invalid signature key');
    }

    console.log(payload);

    const company_subscription_transaction_history =
      await this.prisma.companySubscriptionTransactionHistory.findUnique({
        where: {
          company_subscription_id: payload.order_id,
        },
      });

    if (!company_subscription_transaction_history) {
      throw new BadRequestException('Subscription transaction not found');
    }

    if (payload.transaction_status === 'pending') {
      await this.prisma.companySubscriptionTransactionHistory.update({
        where: {
          company_subscription_id: payload.order_id,
        },
        data: {
          midtrans_status: payload.transaction_status,
          midtrans_payment_method: payload.payment_type,
          midtrans_transaction_id: payload.transaction_id,
        },
      });
    } else if (
      (payload.transaction_status === 'capture' &&
        payload.fraud_status === 'accept') ||
      payload.transaction_status === 'settlement'
    ) {
      await this.prisma.companySubscriptionTransactionHistory.update({
        where: {
          company_subscription_id: payload.order_id,
        },
        data: {
          midtrans_status: payload.transaction_status,
          midtrans_paid_at: new Date(),
        },
      });

      const new_expired_date = () => {
        const now = new Date();
        const dayToMs =
          company_subscription_transaction_history.plan_duration_months *
          30 *
          24 *
          60 *
          60 *
          1000;
        return new Date(now.getTime() + dayToMs);
      };

      await this.prisma.company.update({
        where: {
          company_id: company_subscription_transaction_history.company_id,
        },
        data: {
          level_plan: company_subscription_transaction_history.level_plan,
          plan_expiration: new_expired_date(),
        },
      });
    } else if (
      payload.transaction_status === 'deny' ||
      payload.transaction_status === 'expire' ||
      payload.transaction_status === 'cancel'
    ) {
      await this.prisma.companySubscriptionTransactionHistory.update({
        where: {
          company_subscription_id: payload.order_id,
        },
        data: {
          midtrans_status: payload.transaction_status,
        },
      });
    }

    return true;
  }
}
