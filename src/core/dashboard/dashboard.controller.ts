import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { TokenPayloadInterface } from '../auth/interfaces/token-payload.interface';
import { successResponse } from 'src/utils/response.utils';
import { ChartQueryDto } from './dto/chart-query.dto';
import { EmployeeAuthGuard } from '../auth/guards/employee.guard';

@Controller({ path: '', version: '1' })
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('/company/dashboard')
  @UseGuards(CompanyAuthGuard)
  async getDataDashboard(
    @Req() req: Request & { user: TokenPayloadInterface },
  ) {
    const data = await this.dashboardService.getDataDashboardByCompany(
      req.user.sub,
    );

    return successResponse(data, 'Dashboard data retrieved successfully');
  }

  @Get('/company/dashboard/chart')
  @UseGuards(CompanyAuthGuard)
  async getDataChart(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Query() query: ChartQueryDto,
  ) {
    console.log(query);
    const data = await this.dashboardService.getDataChartByCompany(
      req.user.sub,
      query,
    );

    return successResponse(data, 'Dashboard chart retrieved successfully');
  }

  @Get('/employee/dashboard')
  @UseGuards(EmployeeAuthGuard)
  async getEmployeeDataDashboard(
    @Req() req: Request & { user: TokenPayloadInterface },
  ) {
    const data = await this.dashboardService.getDataDashboardByEmployee(
      req.user.sub,
    );
    return successResponse(data, 'Employee dashboard retrieved successfully');
  }

  @Get('/employee/dashboard/chart')
  @UseGuards(EmployeeAuthGuard)
  async getEmployeeDataChart(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Query() query: ChartQueryDto,
  ) {
    const data = await this.dashboardService.getDataChartByEmployee(
      req.user.sub,
      query,
    );
    return successResponse(
      data,
      'Employee dashboard chart retrieved successfully',
    );
  }
}
