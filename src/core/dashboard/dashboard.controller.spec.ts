import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;

  const dashboardServiceMock = {
    getDataDashboardByCompany: jest.fn(),
    getDataChartByCompany: jest.fn(),
    getDataDashboardByEmployee: jest.fn(),
    getDataChartByEmployee: jest.fn(),
  };

  const mockReqCompany = (companyId = 'company-1') =>
    ({ user: { sub: companyId } }) as any;

  const mockReqEmployee = (employeeId = 'employee-1') =>
    ({ user: { sub: employeeId } }) as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: dashboardServiceMock },
      ],
    }).compile();

    controller = module.get(DashboardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ===================== COMPANY =====================

  describe('getCompanyDashboard', () => {
    it('should return dashboard data for company', async () => {
      const req = mockReqCompany('company-123');
      const mocked = { total_employee: 10 };

      dashboardServiceMock.getDataDashboardByCompany.mockResolvedValue(mocked);

      const res = await controller.getCompanyDashboard(req);

      expect(
        dashboardServiceMock.getDataDashboardByCompany,
      ).toHaveBeenCalledWith('company-123');
      expect(res).toEqual({
        statusCode: 200,
        message: 'Dashboard data retrieved successfully',
        data: mocked,
        errors: null,
      });
    });
  });

  describe('getCompanyDashboardChart', () => {
    it('should return chart data for company', async () => {
      const req = mockReqCompany('company-123');
      const query = { days: 7 } as any;
      const mocked = { granularity: 'day', labels: [], series: {} };

      dashboardServiceMock.getDataChartByCompany.mockResolvedValue(mocked);

      const res = await controller.getCompanyDashboardChart(req, query);

      expect(dashboardServiceMock.getDataChartByCompany).toHaveBeenCalledWith(
        'company-123',
        query,
      );
      expect(res).toEqual({
        statusCode: 200,
        message: 'Dashboard chart retrieved successfully',
        data: mocked,
        errors: null,
      });
    });
  });

  // ===================== EMPLOYEE =====================

  describe('getEmployeeDashboard', () => {
    it('should return dashboard data for employee', async () => {
      const req = mockReqEmployee('emp-123');
      const mocked = { today: { status: 'PRESENT' } };

      dashboardServiceMock.getDataDashboardByEmployee.mockResolvedValue(mocked);

      const res = await controller.getEmployeeDashboard(req);

      expect(
        dashboardServiceMock.getDataDashboardByEmployee,
      ).toHaveBeenCalledWith('emp-123');
      expect(res).toEqual({
        statusCode: 200,
        message: 'Employee dashboard retrieved successfully',
        data: mocked,
        errors: null,
      });
    });
  });

  describe('getEmployeeDashboardChart', () => {
    it('should return chart data for employee', async () => {
      const req = mockReqEmployee('emp-123');
      const query = { start_date: '2025-12-01', end_date: '2025-12-07' } as any;
      const mocked = { granularity: 'day', labels: ['2025-12-01'], series: {} };

      dashboardServiceMock.getDataChartByEmployee.mockResolvedValue(mocked);

      const res = await controller.getEmployeeDashboardChart(req, query);

      expect(dashboardServiceMock.getDataChartByEmployee).toHaveBeenCalledWith(
        'emp-123',
        query,
      );
      expect(res).toEqual({
        statusCode: 200,
        message: 'Employee dashboard chart retrieved successfully',
        data: mocked,
        errors: null,
      });
    });
  });
});
