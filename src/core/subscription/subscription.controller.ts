import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { CreateSnapSubscriptionDto } from './dto/create-snap-subscription.dto';
import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { TokenPayloadInterface } from '../auth/interfaces/token-payload.interface';
import { successResponse } from 'src/utils/response.utils';

@Controller({ path: 'company/subscription', version: '1' })
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post()
  @UseGuards(CompanyAuthGuard)
  async createSnapSubscription(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Body() createSnapSubscriptionDto: CreateSnapSubscriptionDto,
  ) {
    const result = await this.subscriptionService.createSnap(
      createSnapSubscriptionDto,
      req.user,
    );

    return successResponse(
      result,
      'Snap subscription created successfully',
      201,
    );
  }

  @Get()
  @UseGuards(CompanyAuthGuard)
  async getSubscriptionTransactionHistories(
    @Req() req: Request & { user: TokenPayloadInterface },
  ) {
    const histories =
      await this.subscriptionService.getSubscriptionTransactionHistoriesByCompany(
        req.user.sub,
      );
    return successResponse(
      histories,
      'Subscription transaction histories retrieved successfully',
    );
  }

  @Post('webhook')
  async handleMidtransWebhook(@Req() req: Request) {
    await this.subscriptionService.handleMidtransWebhook(req.body);
    return successResponse(null, 'Webhook processed successfully');
  }

  @Get('check-downgrade')
  @UseGuards(CompanyAuthGuard)
  async checkDowngradeSubscription(
    @Req() req: Request & { user: TokenPayloadInterface },
  ) {
    const result = await this.subscriptionService.checkDowngradeSubscription(
      req.user.sub,
    );
    return successResponse(
      result,
      'Downgrade subscription check completed successfully',
    );
  }

  @Get('status')
  @UseGuards(CompanyAuthGuard)
  async getSubscriptionStatus(@Req() req: Request & { user: TokenPayloadInterface }) {
    const result = await this.subscriptionService.getSubscriptionStatus(
      req.user.sub,
    );
    return successResponse(
      result,
      'Subscription status retrieved successfully',
    );
  }
}
