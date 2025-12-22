/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { CreateSnapSubscriptionDto } from './dto/create-snap-subscription.dto';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { CompanyService } from '../company/company.service';
import { MidtransService } from 'src/common/services/midtrans/midtrans.service';
import { SnapDto } from 'src/common/services/midtrans/dto/snap.dto';
import crypto from 'crypto';

import { ConfigService } from '@nestjs/config';
import { addMonthsSafe } from 'src/utils/date.utils';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { daysLeftCeil } from '../../utils/date.utils';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly midtransService: MidtransService,
    private readonly prisma: PrismaService,
    private readonly companyService: CompanyService,
    private readonly configService: ConfigService,
  ) {}

  async createSnap(dto: CreateSnapSubscriptionDto, user: TokenPayloadDto) {
    const company = await this.prisma.company.findUnique({
      where: { company_id: user.sub },
      select: {
        company_id: true,
        name: true,
        email: true,
        level_plan: true,
        plan_expiration: true,
      },
    });

    if (!company) throw new BadRequestException('Company not found');

    const now = new Date();
    const targetPlan = dto.level_plan;
    const durationMonths = dto.duration_months ?? 1;

    const currentPlan = company.level_plan ?? 0;
    const expiresAt = company.plan_expiration;

    // ---------------- Downgrade ----------------
    if (targetPlan < currentPlan) {
      if (!expiresAt)
        throw new BadRequestException('No active subscription to downgrade');

      const daysLeft = daysLeftCeil(expiresAt, now);
      if (daysLeft > 5) {
        throw new BadRequestException(
          `Downgrade hanya boleh jika sisa masa aktif <= 5 hari. Sisa: ${daysLeft} hari`,
        );
      }

      await this.prisma.company.update({
        where: { company_id: company.company_id },
        data: { level_plan: targetPlan },
      });

      await this.prisma.companySubscriptionTransactionHistory.create({
        data: {
          company_subscription_id: `downgrade${currentPlan}to${targetPlan}-${Date.now()}`,
          company_id: company.company_id,
          gross_amount: 0,
          change_type: 'DOWNGRADE',
          from_level_plan: currentPlan,
          level_plan: targetPlan,
          plan_duration_months: 0,
          period_start: now,
          period_end: expiresAt,
          midtrans_status: 'downgraded_no_charge',
          midtrans_paid_at: now,
          midtrans_transaction_token: '-',
          midtrans_redirect_url: '-',
        },
      });

      return { downgrade: true, message: 'Downgrade applied (no charge)' };
    }

    // ---------------- Same plan = Extend ----------------
    if (targetPlan === currentPlan) {
      const gross_amount = this.planPrice(targetPlan) * durationMonths;
      const order_id = `extend${targetPlan}-${Date.now()}`;

      const result: SnapDto = await this.midtransService.createTransaction({
        transaction_details: { order_id, gross_amount },
        customer_details: {
          first_name: `${company.name ?? ''}`,
          email: company.email,
        },
      });

      await this.prisma.companySubscriptionTransactionHistory.create({
        data: {
          company_subscription_id: order_id,
          company_id: company.company_id,
          gross_amount,
          change_type: currentPlan === 0 ? 'NEW' : 'EXTEND',
          from_level_plan: currentPlan,
          level_plan: targetPlan,
          plan_duration_months: durationMonths,
          midtrans_transaction_token: result.token,
          midtrans_redirect_url: result.redirect_url,
        },
      });

      return result;
    }

    // ---------------- Upgrade ----------------
    // targetPlan > currentPlan
    let gross_amount: number;
    let change_type: 'UPGRADE' | 'UPGRADE_RENEW' | 'NEW';

    const isActive =
      !!expiresAt && expiresAt.getTime() > now.getTime() && currentPlan > 0;

    if (isActive) {
      const daysLeft = daysLeftCeil(expiresAt, now);

      // ✅ RULE BARU: kalau <= 5 hari, bayar 1 bulan plan target & extend 1 bulan
      if (daysLeft <= 5) {
        gross_amount = this.planPrice(targetPlan) * 1; // 1 bulan penuh plan target
        change_type = 'UPGRADE_RENEW';
      } else {
        // ✅ "paling adil": pro-rata selisih untuk seluruh sisa masa aktif
        gross_amount = this.proratedUpgradeRemainingTerm({
          currentLevel: currentPlan,
          targetLevel: targetPlan,
          now,
          expiresAt: expiresAt,
        });
        change_type = 'UPGRADE';
      }
    } else {
      // kalau tidak aktif / expired: treat sebagai beli plan baru (boleh durationMonths)
      gross_amount = this.planPrice(targetPlan) * durationMonths;
      change_type = 'NEW';
    }

    const order_id = `upgrade${currentPlan}to${targetPlan}-${Date.now()}`;

    const result: SnapDto = await this.midtransService.createTransaction({
      transaction_details: { order_id, gross_amount },
      customer_details: {
        first_name: `${company.name ?? ''}`,
        email: company.email,
      },
    });

    await this.prisma.companySubscriptionTransactionHistory.create({
      data: {
        company_subscription_id: order_id,
        company_id: company.company_id,
        gross_amount,
        change_type: change_type as any, // kalau enum kamu belum punya UPGRADE_RENEW, lihat catatan di bawah
        from_level_plan: currentPlan,
        level_plan: targetPlan,
        plan_duration_months:
          change_type === 'UPGRADE_RENEW' ? 1 : durationMonths,
        midtrans_transaction_token: result.token,
        midtrans_redirect_url: result.redirect_url,
      },
    });

    return result;
  }

  planPrice(level: number) {
    switch (level) {
      case 1:
        return 299_000;
      case 2:
        return 799_000;
      default:
        return 0;
    }
  }

  proratedUpgradeRemainingTerm(params: {
    currentLevel: number;
    targetLevel: number;
    now: Date;
    expiresAt: Date;
  }) {
    const diffMonthly =
      this.planPrice(params.targetLevel) - this.planPrice(params.currentLevel);
    if (diffMonthly <= 0) return 0;

    if (params.expiresAt.getTime() <= params.now.getTime()) {
      // tidak ada masa aktif, bayar full target 1 bulan
      return this.planPrice(params.targetLevel);
    }

    const remainingDays = Math.ceil(
      (params.expiresAt.getTime() - params.now.getTime()) / 86400000,
    );
    const monthsEquivalent = remainingDays / 30;

    // Midtrans gross_amount harus integer
    const amount = Math.round(diffMonthly * monthsEquivalent);

    // optional minimal charge
    return Math.max(1_000, amount);
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

    const orderId = payload.order_id;

    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.companySubscriptionTransactionHistory.findUnique({
        where: { company_subscription_id: orderId },
        include: {
          company: { select: { company_id: true, plan_expiration: true } },
        },
      });

      if (!sub)
        throw new BadRequestException('Subscription transaction not found');

      const isPending = payload.transaction_status === 'pending';
      const isPaid =
        (payload.transaction_status === 'capture' &&
          payload.fraud_status === 'accept') ||
        payload.transaction_status === 'settlement';
      const isFailed = ['deny', 'expire', 'cancel'].includes(
        payload.transaction_status,
      );

      await tx.companySubscriptionTransactionHistory.update({
        where: { company_subscription_id: orderId },
        data: {
          midtrans_status: payload.transaction_status,
          midtrans_payment_method:
            payload.payment_type ?? sub.midtrans_payment_method,
          midtrans_transaction_id:
            payload.transaction_id ?? sub.midtrans_transaction_id,
        },
      });

      if (isPending || isFailed) return true;
      if (!isPaid) return true;

      // ✅ idempotent
      if (sub.midtrans_paid_at) return true;

      const now = new Date();

      await tx.companySubscriptionTransactionHistory.update({
        where: { company_subscription_id: orderId },
        data: { midtrans_paid_at: now },
      });

      const currentExpiry = sub.company.plan_expiration;
      const baseStart =
        currentExpiry && currentExpiry.getTime() > now.getTime()
          ? currentExpiry
          : now;

      // -------- UPGRADE normal: expiry tetap --------
      if (sub.change_type === 'UPGRADE') {
        const finalExpiry =
          currentExpiry && currentExpiry.getTime() > now.getTime()
            ? currentExpiry
            : addMonthsSafe(now, sub.plan_duration_months ?? 1);

        await tx.company.update({
          where: { company_id: sub.company.company_id },
          data: {
            level_plan: sub.level_plan,
            plan_expiration: finalExpiry,
          },
        });

        await tx.companySubscriptionTransactionHistory.update({
          where: { company_subscription_id: orderId },
          data: { period_start: now, period_end: finalExpiry },
        });

        return true;
      }

      // -------- UPGRADE_RENEW: expiry ditambah 1 bulan --------
      if (sub.change_type === 'UPGRADE_RENEW') {
        const finalExpiry = addMonthsSafe(baseStart, 1);

        await tx.company.update({
          where: { company_id: sub.company.company_id },
          data: {
            level_plan: sub.level_plan,
            plan_expiration: finalExpiry,
          },
        });

        await tx.companySubscriptionTransactionHistory.update({
          where: { company_subscription_id: orderId },
          data: { period_start: baseStart, period_end: finalExpiry },
        });

        return true;
      }

      // -------- NEW / EXTEND / RENEW --------
      if (
        sub.change_type === 'NEW' ||
        sub.change_type === 'RENEW' ||
        sub.change_type === 'EXTEND'
      ) {
        const months = sub.plan_duration_months ?? 1;
        const finalExpiry = addMonthsSafe(baseStart, months);

        await tx.company.update({
          where: { company_id: sub.company.company_id },
          data: {
            level_plan: sub.level_plan,
            plan_expiration: finalExpiry,
          },
        });

        await tx.companySubscriptionTransactionHistory.update({
          where: { company_subscription_id: orderId },
          data: { period_start: baseStart, period_end: finalExpiry },
        });

        return true;
      }

      // DOWNGRADE biasanya no payment, ignore
      return true;
    });
  }

  async checkDowngradeSubscription(company_id: string) {
    const company = await this.companyService.getCompanyById(company_id);
    if (!company) throw new BadRequestException('Company not found');

    const now = new Date();
    const expiresAt = company.plan_expiration;
    const currentPlan = company.level_plan ?? 0;
    if (currentPlan === 0) {
      return {
        can_downgrade: false,
        message: 'No active subscription to downgrade',
      };
    }
    if (!expiresAt || expiresAt.getTime() <= now.getTime()) {
      return {
        can_downgrade: false,
        message: 'No active subscription to downgrade',
      };
    }
    const daysLeft = daysLeftCeil(expiresAt, now);

    if (daysLeft > 5) {
      return {
        can_downgrade: false,
        message: `You can only downgrade when there are 5 days or less remaining. Current remaining days: ${daysLeft} days`,
      };
    }

    return {
      can_downgrade: true,
      message: 'You can downgrade your subscription plan now',
    };
  }

  async getSubscriptionStatus(company_id: string) {
    const company = await this.companyService.getCompanyById(company_id);
    if (!company) throw new BadRequestException('Company not found');

    const now = new Date();
    const expiresAt = company.plan_expiration;

    if (!expiresAt || expiresAt.getTime() <= now.getTime()) {
      return {
        level_plan: 0,
        plan_expiration: null,
      };
    }

    return {
      level_plan: company.level_plan ?? 0,
      plan_expiration: company.plan_expiration,
    };
  }
}
