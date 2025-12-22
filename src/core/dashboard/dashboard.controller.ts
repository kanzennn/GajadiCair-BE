import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { successResponse } from 'src/utils/response.utils';

@Controller({ path: '', version: '1' })
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('/company/dashboard')
  @UseGuards(CompanyAuthGuard)
  async getDataDashboard(@Req() req: Request & { user: TokenPayloadDto }) {
    const data = await this.dashboardService.getDataDashboard(req.user.sub);

    return successResponse(data, 'Dashboard data retrieved successfully');
  }
}
