import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { CreateSnapSubscriptionDto } from './dto/create-snap-subscription.dto';
import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { successResponse } from 'src/utils/response.utils';

@Controller({ path: 'company/subscription', version: '1' })
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post()
  @UseGuards(CompanyAuthGuard)
  async createSnapSubscription(
    @Req() req: Request & { user: TokenPayloadDto },
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
    @Req() req: Request & { user: TokenPayloadDto },
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
}
