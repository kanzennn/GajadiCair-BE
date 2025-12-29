/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';

import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

describe('SubscriptionController', () => {
  let controller: SubscriptionController;

  const subscriptionService = {
    createSnap: jest.fn(),
    getSubscriptionTransactionHistoriesByCompany: jest.fn(),
    handleMidtransWebhook: jest.fn(),
    checkDowngradeSubscription: jest.fn(),
    getSubscriptionStatus: jest.fn(),
  };

  // Guard di unit test controller biasanya cukup di-bypass
  const companyAuthGuard = {
    canActivate: jest.fn(() => true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionController],
      providers: [
        { provide: SubscriptionService, useValue: subscriptionService },
      ],
    })
      .overrideGuard(CompanyAuthGuard)
      .useValue(companyAuthGuard)
      .compile();

    controller = module.get(SubscriptionController);
  });

  describe('createSnapSubscription', () => {
    it('should call service.createSnap and return success response', async () => {
      subscriptionService.createSnap.mockResolvedValue({
        token: 'snap-token',
        redirect_url: 'https://midtrans/redirect',
      });

      const req: any = { user: { sub: 'c1', role: 'company' } };
      const dto: any = { level_plan: 1, duration_months: 1 };

      const res = await controller.createSnapSubscription(req, dto);

      expect(subscriptionService.createSnap).toHaveBeenCalledWith(
        dto,
        req.user,
      );

      expect(res).toEqual({
        statusCode: 201,
        message: 'Snap subscription created successfully',
        data: {
          token: 'snap-token',
          redirect_url: 'https://midtrans/redirect',
        },
        errors: null,
      });
    });

    it('should bubble up service error', async () => {
      subscriptionService.createSnap.mockRejectedValue(
        new BadRequestException('Company not found'),
      );

      const req: any = { user: { sub: 'c1', role: 'company' } };
      const dto: any = { level_plan: 1, duration_months: 1 };

      await expect(
        controller.createSnapSubscription(req, dto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getSubscriptionTransactionHistories', () => {
    it('should return histories', async () => {
      subscriptionService.getSubscriptionTransactionHistoriesByCompany.mockResolvedValue(
        [{ company_subscription_id: 'o1' }],
      );

      const req: any = { user: { sub: 'c1', role: 'company' } };

      const res = await controller.getSubscriptionTransactionHistories(req);

      expect(
        subscriptionService.getSubscriptionTransactionHistoriesByCompany,
      ).toHaveBeenCalledWith('c1');

      expect(res).toEqual({
        statusCode: 200,
        message: 'Subscription transaction histories retrieved successfully',
        data: [{ company_subscription_id: 'o1' }],
        errors: null,
      });
    });
  });

  describe('handleMidtransWebhook', () => {
    it('should call handleMidtransWebhook and return ok', async () => {
      subscriptionService.handleMidtransWebhook.mockResolvedValue(true);

      const req: any = {
        body: {
          order_id: 'o1',
          transaction_status: 'settlement',
          status_code: '200',
          gross_amount: '299000',
          signature_key: 'sig',
        },
      };

      const res = await controller.handleMidtransWebhook(req);

      expect(subscriptionService.handleMidtransWebhook).toHaveBeenCalledWith(
        req.body,
      );

      expect(res).toEqual({
        statusCode: 200,
        message: 'Webhook processed successfully',
        data: null,
        errors: null,
      });
    });

    it('should bubble up service error', async () => {
      subscriptionService.handleMidtransWebhook.mockRejectedValue(
        new BadRequestException('Invalid signature key'),
      );

      const req: any = { body: { order_id: 'o1' } };

      await expect(
        controller.handleMidtransWebhook(req),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('checkDowngradeSubscription', () => {
    it('should return downgrade check result', async () => {
      subscriptionService.checkDowngradeSubscription.mockResolvedValue({
        can_downgrade: true,
        message: 'ok',
      });

      const req: any = { user: { sub: 'c1', role: 'company' } };

      const res = await controller.checkDowngradeSubscription(req);

      expect(
        subscriptionService.checkDowngradeSubscription,
      ).toHaveBeenCalledWith('c1');

      expect(res).toEqual({
        statusCode: 200,
        message: 'Downgrade subscription check completed successfully',
        data: { can_downgrade: true, message: 'ok' },
        errors: null,
      });
    });
  });

  describe('getSubscriptionStatus', () => {
    it('should return subscription status', async () => {
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 1,
        plan_expiration: new Date('2030-01-01T00:00:00.000Z'),
      });

      const req: any = { user: { sub: 'c1', role: 'company' } };

      const res = await controller.getSubscriptionStatus(req);

      expect(subscriptionService.getSubscriptionStatus).toHaveBeenCalledWith(
        'c1',
      );

      expect(res.statusCode).toBe(200);
      expect(res.message).toBe('Subscription status retrieved successfully');
      expect(res.data.level_plan).toBe(1);
      expect(res.data.plan_expiration).toBeInstanceOf(Date);
    });

    it('should bubble up service error', async () => {
      subscriptionService.getSubscriptionStatus.mockRejectedValue(
        new BadRequestException('Company not found'),
      );

      const req: any = { user: { sub: 'c1', role: 'company' } };

      await expect(
        controller.getSubscriptionStatus(req),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
