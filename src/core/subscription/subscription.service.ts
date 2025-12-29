/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { MidtransService } from 'src/common/services/midtrans/midtrans.service';
import { SnapDto } from 'src/common/services/midtrans/dto/snap.dto';

import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

import { TokenPayloadInterface } from '../auth/interfaces/token-payload.interface';
import { CreateSnapSubscriptionDto } from './dto/create-snap-subscription.dto';

import { addMonthsSafe, daysLeftCeil } from 'src/utils/date.utils';

type ChangeType =
  | 'NEW'
  | 'EXTEND'
  | 'RENEW'
  | 'UPGRADE'
  | 'UPGRADE_RENEW'
  | 'DOWNGRADE';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly midtransService: MidtransService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ===================== PUBLIC =====================

  async createSnap(
    dto: CreateSnapSubscriptionDto,
    user: TokenPayloadInterface,
  ) {
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

    // ---------------- Downgrade (no payment) ----------------
    if (targetPlan < currentPlan) {
      return this.applyDowngrade({
        companyId: company.company_id,
        now,
        targetPlan,
        currentPlan,
        expiresAt,
      });
    }

    // ---------------- Same plan => Extend ----------------
    if (targetPlan === currentPlan) {
      return this.createMidtransTransaction({
        companyId: company.company_id,
        companyName: company.name ?? '',
        companyEmail: company.email,
        orderId: `extend${targetPlan}-${Date.now()}`,
        grossAmount: this.planPrice(targetPlan) * durationMonths,
        changeType: currentPlan === 0 ? 'NEW' : 'EXTEND',
        fromLevelPlan: currentPlan,
        levelPlan: targetPlan,
        durationMonths,
      });
    }

    // ---------------- Upgrade ----------------
    // targetPlan > currentPlan
    const { grossAmount, changeType, monthsForHistory } =
      this.computeUpgradeCharge({
        now,
        currentPlan,
        targetPlan,
        durationMonths,
        expiresAt,
      });

    return this.createMidtransTransaction({
      companyId: company.company_id,
      companyName: company.name ?? '',
      companyEmail: company.email,
      orderId: `upgrade${currentPlan}to${targetPlan}-${Date.now()}`,
      grossAmount,
      changeType,
      fromLevelPlan: currentPlan,
      levelPlan: targetPlan,
      durationMonths: monthsForHistory,
    });
  }

  async getSubscriptionTransactionHistoriesByCompany(company_id: string) {
    return this.prisma.companySubscriptionTransactionHistory.findMany({
      where: { company_id },
      orderBy: { created_at: 'desc' },
    });
  }

  async handleMidtransWebhook(payload: any) {
    this.assertMidtransSignatureOrThrow(payload);

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

      // pending / fail / unknown => stop
      if (isPending || isFailed || !isPaid) return true;

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

      // -------- UPGRADE: expiry tetap kalau masih aktif, kalau expired => start baru --------
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

      // -------- UPGRADE_RENEW: expiry ditambah 1 bulan dari baseStart --------
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

      // DOWNGRADE (biasanya no payment) => ignore
      return true;
    });
  }

  async checkDowngradeSubscription(company_id: string) {
    const company = await this.prisma.company.findUnique({
      where: { company_id },
      select: { level_plan: true, plan_expiration: true },
    });
    if (!company) throw new BadRequestException('Company not found');

    const now = new Date();
    const expiresAt = company.plan_expiration;
    const currentPlan = company.level_plan ?? 0;

    if (
      currentPlan === 0 ||
      !expiresAt ||
      expiresAt.getTime() <= now.getTime()
    ) {
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
    const company = await this.prisma.company.findUnique({
      where: { company_id },
      select: { level_plan: true, plan_expiration: true },
    });
    if (!company) throw new BadRequestException('Company not found');

    const now = new Date();
    const expiresAt = company.plan_expiration;

    if (!expiresAt || expiresAt.getTime() <= now.getTime()) {
      return { level_plan: 0, plan_expiration: null };
    }

    return {
      level_plan: company.level_plan ?? 0,
      plan_expiration: company.plan_expiration,
    };
  }

  // ===================== PRICING =====================

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
      return this.planPrice(params.targetLevel);
    }

    const remainingDays = Math.ceil(
      (params.expiresAt.getTime() - params.now.getTime()) / 86_400_000,
    );
    const monthsEquivalent = remainingDays / 30;

    const amount = Math.round(diffMonthly * monthsEquivalent);

    // optional minimal charge
    return Math.max(1_000, amount);
  }

  // ===================== PRIVATE HELPERS =====================

  private async applyDowngrade(params: {
    companyId: string;
    now: Date;
    targetPlan: number;
    currentPlan: number;
    expiresAt: Date | null;
  }) {
    const { companyId, now, targetPlan, currentPlan, expiresAt } = params;

    if (!expiresAt)
      throw new BadRequestException('No active subscription to downgrade');

    const daysLeft = daysLeftCeil(expiresAt, now);
    if (daysLeft > 5) {
      throw new BadRequestException(
        `Downgrade hanya boleh jika sisa masa aktif <= 5 hari. Sisa: ${daysLeft} hari`,
      );
    }

    await this.prisma.company.update({
      where: { company_id: companyId },
      data: { level_plan: targetPlan },
    });

    await this.prisma.companySubscriptionTransactionHistory.create({
      data: {
        company_subscription_id: `downgrade${currentPlan}to${targetPlan}-${Date.now()}`,
        company_id: companyId,
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

  private computeUpgradeCharge(params: {
    now: Date;
    currentPlan: number;
    targetPlan: number;
    durationMonths: number;
    expiresAt: Date | null;
  }): {
    grossAmount: number;
    changeType: ChangeType;
    monthsForHistory: number;
  } {
    const { now, currentPlan, targetPlan, durationMonths, expiresAt } = params;

    const isActive =
      !!expiresAt && expiresAt.getTime() > now.getTime() && currentPlan > 0;

    if (!isActive) {
      return {
        grossAmount: this.planPrice(targetPlan) * durationMonths,
        changeType: 'NEW',
        monthsForHistory: durationMonths,
      };
    }

    const daysLeft = daysLeftCeil(expiresAt, now);

    // RULE: <= 5 hari => bayar 1 bulan plan target & extend 1 bulan
    if (daysLeft <= 5) {
      return {
        grossAmount: this.planPrice(targetPlan) * 1,
        changeType: 'UPGRADE_RENEW',
        monthsForHistory: 1,
      };
    }

    // pro-rata selisih untuk sisa masa aktif
    return {
      grossAmount: this.proratedUpgradeRemainingTerm({
        currentLevel: currentPlan,
        targetLevel: targetPlan,
        now,
        expiresAt: expiresAt,
      }),
      changeType: 'UPGRADE',
      monthsForHistory: durationMonths,
    };
  }

  private async createMidtransTransaction(params: {
    companyId: string;
    companyName: string;
    companyEmail: string;
    orderId: string;
    grossAmount: number;
    changeType: ChangeType;
    fromLevelPlan: number;
    levelPlan: number;
    durationMonths: number;
  }) {
    const {
      companyId,
      companyName,
      companyEmail,
      orderId,
      grossAmount,
      changeType,
      fromLevelPlan,
      levelPlan,
      durationMonths,
    } = params;

    const result: SnapDto = await this.midtransService.createTransaction({
      transaction_details: { order_id: orderId, gross_amount: grossAmount },
      customer_details: {
        first_name: `${companyName}`,
        email: companyEmail,
      },
    });

    await this.prisma.companySubscriptionTransactionHistory.create({
      data: {
        company_subscription_id: orderId,
        company_id: companyId,
        gross_amount: grossAmount,
        change_type: changeType as any, // NOTE: sesuaikan kalau enum DB belum punya value-nya
        from_level_plan: fromLevelPlan,
        level_plan: levelPlan,
        plan_duration_months: durationMonths,
        midtrans_transaction_token: result.token,
        midtrans_redirect_url: result.redirect_url,
      },
    });

    return result;
  }

  private assertMidtransSignatureOrThrow(payload: any) {
    const serverKey = this.configService.get<string>('MIDTRANS_SERVER_KEY');

    const expected = crypto
      .createHash('sha512')
      .update(
        `${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey}`,
      )
      .digest('hex');

    if (expected !== payload.signature_key) {
      throw new BadRequestException('Invalid signature key');
    }
  }
}
