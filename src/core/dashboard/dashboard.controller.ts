import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { TokenPayloadInterface } from '../auth/interfaces/token-payload.interface';
import { successResponse } from 'src/utils/response.utils';
import { ChartCompanyQueryDto } from './dto/chart-company-query.dto';

@Controller({ path: '', version: '1' })
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('/company/dashboard')
  @UseGuards(CompanyAuthGuard)
  async getDataDashboard(
    @Req() req: Request & { user: TokenPayloadInterface },
  ) {
    const data = await this.dashboardService.getDataDashboard(req.user.sub);

    return successResponse(data, 'Dashboard data retrieved successfully');
  }

  @Get('/company/dashboard/chart')
  @UseGuards(CompanyAuthGuard)
  async getDataChart(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Query() query: ChartCompanyQueryDto,
  ) {
    console.log(query);
    const data = await this.dashboardService.getDataChart(req.user.sub, query);

    return successResponse(data, 'Dashboard chart retrieved successfully');
  }
}
