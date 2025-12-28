/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { successResponse } from 'src/utils/response.utils';

// mock successResponse supaya predictable
jest.mock('src/utils/response.utils', () => ({
  successResponse: jest.fn((data, message) => ({
    data,
    message,
    statusCode: 200,
  })),
}));

describe('DashboardController', () => {
  let controller: DashboardController;

  const dashboardService = {
    getDataDashboard: jest.fn(),
    getDataChart: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: dashboardService }],
    })
      // ✅ bypass auth guard
      .overrideGuard(CompanyAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { sub: 'company-1' }; // mock token payload
          return true;
        },
      })
      .compile();

    controller = module.get(DashboardController);
  });

  describe('getDataDashboard', () => {
    it('should call service with companyId from token and return success response', async () => {
      const mockResult = {
        total_employee: 10,
        employeePresentToday: 7,
        employeeHasNotCheckInToday: 2,
        employeeHasNotCheckedOut: 1,
        attendanceLog: [],
      };

      dashboardService.getDataDashboard.mockResolvedValue(mockResult);

      const res = await controller.getDataDashboard({
        user: { sub: 'company-1' },
      } as any);

      // service dipanggil benar
      expect(dashboardService.getDataDashboard).toHaveBeenCalledWith(
        'company-1',
      );

      // response dibungkus successResponse
      expect(successResponse).toHaveBeenCalledWith(
        mockResult,
        'Dashboard data retrieved successfully',
      );

      expect(res).toEqual({
        data: mockResult,
        message: 'Dashboard data retrieved successfully',
        statusCode: 200,
      });
    });
  });

  describe('getDataChart', () => {
    it('should call service with companyId and query dto', async () => {
      const query = {
        days: 7,
      };

      const mockChart = {
        granularity: 'day',
        labels: ['2025-12-26'],
        series: {
          PRESENT: [5],
          LATE: [1],
          ABSENT: [0],
          LEAVE: [0],
          SICK: [0],
          total: [6],
        },
        points: [],
        range: {
          start: '2025-12-26',
          end: '2025-12-26',
          days: 1,
        },
      };

      dashboardService.getDataChart.mockResolvedValue(mockChart);

      const res = await controller.getDataChart(
        { user: { sub: 'company-1' } } as any,
        query as any,
      );

      // service dipanggil dengan user.sub + query
      expect(dashboardService.getDataChart).toHaveBeenCalledWith(
        'company-1',
        query,
      );

      expect(successResponse).toHaveBeenCalledWith(
        mockChart,
        'Dashboard chart retrieved successfully',
      );

      expect(res).toEqual({
        data: mockChart,
        message: 'Dashboard chart retrieved successfully',
        statusCode: 200,
      });
    });

    it('should pass empty query object if no query params provided', async () => {
      dashboardService.getDataChart.mockResolvedValue({});

      const res = await controller.getDataChart(
        { user: { sub: 'company-1' } } as any,
        {} as any,
      );

      expect(dashboardService.getDataChart).toHaveBeenCalledWith(
        'company-1',
        {},
      );
      expect(res.statusCode).toBe(200);
    });
  });
});
