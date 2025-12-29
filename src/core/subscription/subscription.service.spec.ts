/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { MidtransService } from 'src/common/services/midtrans/midtrans.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import crypto from 'node:crypto';

describe('SubscriptionService', () => {
  let service: SubscriptionService;

  const prisma = {
    company: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    companySubscriptionTransactionHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (cb: any) => cb(prisma)),
  };

  const midtransService = {
    createTransaction: jest.fn(),
  };

  const configService = {
    get: jest.fn(),
  };

  const fixedNow = new Date('2025-12-29T10:00:00.000Z');

  beforeEach(async () => {
    jest.clearAllMocks();

    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);

    // biar order_id stabil
    jest.spyOn(Date, 'now').mockReturnValue(123456789);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: prisma },
        { provide: MidtransService, useValue: midtransService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(SubscriptionService);
  });

  afterEach(() => {
    jest.useRealTimers();
    (Date.now as any).mockRestore?.();
  });

  describe('createSnap', () => {
    it('should throw when company not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.createSnap(
          { level_plan: 1, duration_months: 1 } as any,
          {
            sub: 'c1',
          } as any,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should downgrade (no charge) when daysLeft <= 5', async () => {
      // currentPlan 2 -> target 1
      prisma.company.findUnique.mockResolvedValue({
        company_id: 'c1',
        name: 'A',
        email: 'a@a.com',
        level_plan: 2,
        plan_expiration: new Date('2026-01-02T00:00:00.000Z'), // ~4 hari
      });

      prisma.company.update.mockResolvedValue({});
      prisma.companySubscriptionTransactionHistory.create.mockResolvedValue({});

      const res = await service.createSnap(
        { level_plan: 1 } as any,
        { sub: 'c1' } as any,
      );

      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { company_id: 'c1' },
        data: { level_plan: 1 },
      });

      expect(
        prisma.companySubscriptionTransactionHistory.create,
      ).toHaveBeenCalled();
      expect(res).toEqual({
        downgrade: true,
        message: 'Downgrade applied (no charge)',
      });
    });

    it('should throw downgrade when daysLeft > 5', async () => {
      prisma.company.findUnique.mockResolvedValue({
        company_id: 'c1',
        name: 'A',
        email: 'a@a.com',
        level_plan: 2,
        plan_expiration: new Date('2026-01-20T00:00:00.000Z'), // > 5 hari
      });

      await expect(
        service.createSnap({ level_plan: 1 } as any, { sub: 'c1' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should extend same plan and create midtrans transaction', async () => {
      prisma.company.findUnique.mockResolvedValue({
        company_id: 'c1',
        name: 'A',
        email: 'a@a.com',
        level_plan: 1,
        plan_expiration: new Date('2026-01-10T00:00:00.000Z'),
      });

      midtransService.createTransaction.mockResolvedValue({
        token: 't',
        redirect_url: 'url',
      });

      prisma.companySubscriptionTransactionHistory.create.mockResolvedValue({});

      const res = await service.createSnap(
        { level_plan: 1, duration_months: 2 } as any,
        { sub: 'c1' } as any,
      );

      expect(midtransService.createTransaction).toHaveBeenCalledWith({
        transaction_details: {
          order_id: 'extend1-123456789',
          gross_amount: 299_000 * 2,
        },
        customer_details: { first_name: 'A', email: 'a@a.com' },
      });

      expect(
        prisma.companySubscriptionTransactionHistory.create,
      ).toHaveBeenCalled();
      expect(res).toEqual({ token: 't', redirect_url: 'url' });
    });

    it('should upgrade active plan with UPGRADE_RENEW when daysLeft <= 5', async () => {
      prisma.company.findUnique.mockResolvedValue({
        company_id: 'c1',
        name: 'A',
        email: 'a@a.com',
        level_plan: 1,
        plan_expiration: new Date('2026-01-02T00:00:00.000Z'), // <=5 hari
      });

      midtransService.createTransaction.mockResolvedValue({
        token: 't',
        redirect_url: 'url',
      });

      prisma.companySubscriptionTransactionHistory.create.mockResolvedValue({});

      const res = await service.createSnap(
        { level_plan: 2, duration_months: 3 } as any,
        { sub: 'c1' } as any,
      );

      // UPGRADE_RENEW => bayar 1 bulan target
      expect(midtransService.createTransaction).toHaveBeenCalledWith({
        transaction_details: {
          order_id: 'upgrade1to2-123456789',
          gross_amount: 799_000 * 1,
        },
        customer_details: { first_name: 'A', email: 'a@a.com' },
      });

      expect(
        prisma.companySubscriptionTransactionHistory.create,
      ).toHaveBeenCalled();
      expect(res).toEqual({ token: 't', redirect_url: 'url' });
    });

    it('should upgrade active plan with prorated UPGRADE when daysLeft > 5', async () => {
      prisma.company.findUnique.mockResolvedValue({
        company_id: 'c1',
        name: 'A',
        email: 'a@a.com',
        level_plan: 1,
        plan_expiration: new Date('2026-02-28T00:00:00.000Z'), // jauh >5 hari
      });

      midtransService.createTransaction.mockResolvedValue({
        token: 't',
        redirect_url: 'url',
      });

      prisma.companySubscriptionTransactionHistory.create.mockResolvedValue({});

      const res = await service.createSnap(
        { level_plan: 2, duration_months: 2 } as any,
        { sub: 'c1' } as any,
      );

      // gak assert exact gross_amount karena prorata, tapi pastikan called + integer > 0
      const call = midtransService.createTransaction.mock.calls[0][0];
      expect(call.transaction_details.order_id).toBe('upgrade1to2-123456789');
      expect(typeof call.transaction_details.gross_amount).toBe('number');
      expect(call.transaction_details.gross_amount).toBeGreaterThan(0);

      expect(res).toEqual({ token: 't', redirect_url: 'url' });
    });

    it('should treat upgrade as NEW when expired/inactive', async () => {
      prisma.company.findUnique.mockResolvedValue({
        company_id: 'c1',
        name: 'A',
        email: 'a@a.com',
        level_plan: 1,
        plan_expiration: new Date('2025-01-01T00:00:00.000Z'), // expired
      });

      midtransService.createTransaction.mockResolvedValue({
        token: 't',
        redirect_url: 'url',
      });

      prisma.companySubscriptionTransactionHistory.create.mockResolvedValue({});

      const res = await service.createSnap(
        { level_plan: 2, duration_months: 2 } as any,
        { sub: 'c1' } as any,
      );

      expect(midtransService.createTransaction).toHaveBeenCalledWith({
        transaction_details: {
          order_id: 'upgrade1to2-123456789',
          gross_amount: 799_000 * 2,
        },
        customer_details: { first_name: 'A', email: 'a@a.com' },
      });

      expect(res).toEqual({ token: 't', redirect_url: 'url' });
    });
  });

  describe('getSubscriptionStatus', () => {
    it('should return free when expired', async () => {
      prisma.company.findUnique.mockResolvedValue({
        level_plan: 2,
        plan_expiration: new Date('2025-01-01T00:00:00.000Z'),
      });

      const res = await service.getSubscriptionStatus('c1');

      expect(res).toEqual({ level_plan: 0, plan_expiration: null });
    });

    it('should return current plan when active', async () => {
      prisma.company.findUnique.mockResolvedValue({
        level_plan: 2,
        plan_expiration: new Date('2026-01-01T00:00:00.000Z'),
      });

      const res = await service.getSubscriptionStatus('c1');

      expect(res.level_plan).toBe(2);
      expect(res.plan_expiration).toBeInstanceOf(Date);
    });
  });

  describe('checkDowngradeSubscription', () => {
    it('should return can_downgrade false when no active plan', async () => {
      prisma.company.findUnique.mockResolvedValue({
        level_plan: 0,
        plan_expiration: null,
      });

      const res = await service.checkDowngradeSubscription('c1');

      expect(res.can_downgrade).toBe(false);
    });

    it('should return can_downgrade true when daysLeft <= 5', async () => {
      prisma.company.findUnique.mockResolvedValue({
        level_plan: 2,
        plan_expiration: new Date('2026-01-02T00:00:00.000Z'),
      });

      const res = await service.checkDowngradeSubscription('c1');

      expect(res.can_downgrade).toBe(true);
    });
  });

  describe('handleMidtransWebhook', () => {
    const serverKey = 'server_key';

    beforeEach(() => {
      configService.get.mockReturnValue(serverKey);
    });

    it('should throw invalid signature', async () => {
      const payload = {
        order_id: 'o1',
        status_code: '200',
        gross_amount: '1000',
        signature_key: 'WRONG',
      };

      await expect(
        service.handleMidtransWebhook(payload),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should return true on pending', async () => {
      const payload = {
        order_id: 'o1',
        status_code: '200',
        gross_amount: '1000',
        transaction_status: 'pending',
        signature_key: crypto
          .createHash('sha512')
          .update(`o12001000${serverKey}`)
          .digest('hex'),
      };

      prisma.companySubscriptionTransactionHistory.findUnique.mockResolvedValue(
        {
          company_subscription_id: 'o1',
          midtrans_paid_at: null,
          change_type: 'NEW',
          level_plan: 1,
          plan_duration_months: 1,
          company: { company_id: 'c1', plan_expiration: null },
          midtrans_payment_method: null,
          midtrans_transaction_id: null,
        },
      );

      prisma.companySubscriptionTransactionHistory.update.mockResolvedValue({});

      const res = await service.handleMidtransWebhook(payload);

      expect(res).toBe(true);
      // should update midtrans_status
      expect(
        prisma.companySubscriptionTransactionHistory.update,
      ).toHaveBeenCalled();
    });

    it('should be idempotent if already paid', async () => {
      const payload = {
        order_id: 'o1',
        status_code: '200',
        gross_amount: '1000',
        transaction_status: 'settlement',
        signature_key: crypto
          .createHash('sha512')
          .update(`o12001000${serverKey}`)
          .digest('hex'),
      };

      prisma.companySubscriptionTransactionHistory.findUnique.mockResolvedValue(
        {
          company_subscription_id: 'o1',
          midtrans_paid_at: new Date('2025-12-01T00:00:00.000Z'),
          change_type: 'NEW',
          level_plan: 1,
          plan_duration_months: 1,
          company: { company_id: 'c1', plan_expiration: null },
        },
      );

      prisma.companySubscriptionTransactionHistory.update.mockResolvedValue({});

      const res = await service.handleMidtransWebhook(payload);

      expect(res).toBe(true);
      // should NOT update company when already paid
      expect(prisma.company.update).not.toHaveBeenCalled();
    });

    it('should apply NEW/EXTEND when paid (settlement)', async () => {
      const payload = {
        order_id: 'o1',
        status_code: '200',
        gross_amount: '1000',
        transaction_status: 'settlement',
        payment_type: 'bank_transfer',
        transaction_id: 'trx',
        signature_key: crypto
          .createHash('sha512')
          .update(`o12001000${serverKey}`)
          .digest('hex'),
      };

      prisma.companySubscriptionTransactionHistory.findUnique.mockResolvedValue(
        {
          company_subscription_id: 'o1',
          midtrans_paid_at: null,
          change_type: 'NEW',
          level_plan: 1,
          plan_duration_months: 2,
          company: { company_id: 'c1', plan_expiration: null },
          midtrans_payment_method: null,
          midtrans_transaction_id: null,
        },
      );

      prisma.companySubscriptionTransactionHistory.update.mockResolvedValue({});
      prisma.company.update.mockResolvedValue({});

      const res = await service.handleMidtransWebhook(payload);

      expect(res).toBe(true);
      expect(prisma.company.update).toHaveBeenCalled(); // update level_plan & plan_expiration
      expect(
        prisma.companySubscriptionTransactionHistory.update,
      ).toHaveBeenCalled();
    });
  });
});
