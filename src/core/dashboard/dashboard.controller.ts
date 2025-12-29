import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { DashboardService } from './dashboard.service';
import { ChartQueryDto } from './dto/chart-query.dto';

import { successResponse } from 'src/utils/response.utils';

import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { EmployeeAuthGuard } from '../auth/guards/employee.guard';
import { TokenPayloadInterface } from '../auth/interfaces/token-payload.interface';

@Controller({ version: '1' })
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // ===================== COMPANY =====================

  @Get('company/dashboard')
  @UseGuards(CompanyAuthGuard)
  async getCompanyDashboard(
    @Req() req: Request & { user: TokenPayloadInterface },
  ) {
    const data = await this.dashboardService.getDataDashboardByCompany(
      req.user.sub,
    );

    return successResponse(data, 'Dashboard data retrieved successfully');
  }

  @Get('company/dashboard/chart')
  @UseGuards(CompanyAuthGuard)
  async getCompanyDashboardChart(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Query() query: ChartQueryDto,
  ) {
    const data = await this.dashboardService.getDataChartByCompany(
      req.user.sub,
      query,
    );

    return successResponse(data, 'Dashboard chart retrieved successfully');
  }

  // ===================== EMPLOYEE =====================

  @Get('employee/dashboard')
  @UseGuards(EmployeeAuthGuard)
  async getEmployeeDashboard(
    @Req() req: Request & { user: TokenPayloadInterface },
  ) {
    const data = await this.dashboardService.getDataDashboardByEmployee(
      req.user.sub,
    );

    return successResponse(data, 'Employee dashboard retrieved successfully');
  }

  @Get('employee/dashboard/chart')
  @UseGuards(EmployeeAuthGuard)
  async getEmployeeDashboardChart(
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
