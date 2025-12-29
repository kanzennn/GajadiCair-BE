import { Test, TestingModule } from '@nestjs/testing';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

describe('PayrollController', () => {
  let controller: PayrollController;

  const payrollService = {
    getCompanyPayrollSummary: jest.fn(),
    getAllPayrollLogByCompany: jest.fn(),
    getOnePayrollLog: jest.fn(),
    getEmployeePayroll: jest.fn(),
    getAllPayrollLogByEmployee: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PayrollController],
      providers: [{ provide: PayrollService, useValue: payrollService }],
    }).compile();

    controller = module.get(PayrollController);
  });

  const companyReq = (companyId = 'c1') =>
    ({ user: { sub: companyId, role: 'company' } }) as any;

  const employeeReq = (employeeId = 'e1') =>
    ({ user: { sub: employeeId, role: 'employee' } }) as any;

  // ===================== COMPANY =====================

  describe('getCompanyPayrollSummary', () => {
    it('should call service and return response', async () => {
      payrollService.getCompanyPayrollSummary.mockResolvedValue([
        { employee_id: 'e1' },
      ]);

      const res = await controller.getCompanyPayrollSummary(companyReq('c1'));

      expect(payrollService.getCompanyPayrollSummary).toHaveBeenCalledWith(
        'c1',
      );
      expect(res).toEqual(
        expect.objectContaining({
          message: 'Company payroll summary retrieved',
        }),
      );
    });
  });

  describe('getCompanyPayrollHistory', () => {
    it('should call service and return response', async () => {
      payrollService.getAllPayrollLogByCompany.mockResolvedValue([
        { payroll_log_id: 'p1' },
      ]);

      const res = await controller.getCompanyPayrollHistory(companyReq('c1'));

      expect(payrollService.getAllPayrollLogByCompany).toHaveBeenCalledWith(
        'c1',
      );
      expect(res).toEqual(
        expect.objectContaining({
          message: 'Payroll history retrieved',
        }),
      );
    });
  });

  describe('getCompanyPayrollLogDetail', () => {
    it('should return detail when company is owner', async () => {
      payrollService.getOnePayrollLog.mockResolvedValue({
        payroll_log_id: 'p1',
        employee: { company_id: 'c1', employee_id: 'e1' },
      });

      const res = await controller.getCompanyPayrollLogDetail(
        companyReq('c1'),
        'p1',
      );

      expect(payrollService.getOnePayrollLog).toHaveBeenCalledWith('p1');
      expect(res).toEqual(
        expect.objectContaining({
          message: 'Payroll log details retrieved',
        }),
      );
    });

    it('should throw when company is not owner', async () => {
      payrollService.getOnePayrollLog.mockResolvedValue({
        payroll_log_id: 'p1',
        employee: { company_id: 'c2', employee_id: 'e1' },
      });

      await expect(
        controller.getCompanyPayrollLogDetail(companyReq('c1'), 'p1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ===================== EMPLOYEE =====================

  describe('getMyPayrollSummary', () => {
    it('should call service and return response', async () => {
      payrollService.getEmployeePayroll.mockResolvedValue({
        take_home_pay: 123,
      });

      const res = await controller.getMyPayrollSummary(employeeReq('e1'));

      expect(payrollService.getEmployeePayroll).toHaveBeenCalledWith('e1');
      expect(res).toEqual(
        expect.objectContaining({
          message: 'Payroll summary retrieved',
        }),
      );
    });
  });

  describe('getMyPayrollHistory', () => {
    it('should call service and return response', async () => {
      payrollService.getAllPayrollLogByEmployee.mockResolvedValue([
        { payroll_log_id: 'p1' },
      ]);

      const res = await controller.getMyPayrollHistory(employeeReq('e1'));

      expect(payrollService.getAllPayrollLogByEmployee).toHaveBeenCalledWith(
        'e1',
      );
      expect(res).toEqual(
        expect.objectContaining({
          message: 'Payroll history retrieved',
        }),
      );
    });
  });

  describe('getMyPayrollLogDetail', () => {
    it('should return detail when employee is owner (employee_id top-level)', async () => {
      payrollService.getOnePayrollLog.mockResolvedValue({
        payroll_log_id: 'p1',
        employee_id: 'e1',
        employee: { company_id: 'c1', employee_id: 'e1' },
      });

      const res = await controller.getMyPayrollLogDetail(
        employeeReq('e1'),
        'p1',
      );

      expect(payrollService.getOnePayrollLog).toHaveBeenCalledWith('p1');
      expect(res).toEqual(
        expect.objectContaining({
          message: 'Payroll log details retrieved',
        }),
      );
    });

    it('should return detail when employee is owner (employee nested)', async () => {
      payrollService.getOnePayrollLog.mockResolvedValue({
        payroll_log_id: 'p1',
        employee: { company_id: 'c1', employee_id: 'e1' },
        payroll_details: [],
      });

      const res = await controller.getMyPayrollLogDetail(
        employeeReq('e1'),
        'p1',
      );

      expect(payrollService.getOnePayrollLog).toHaveBeenCalledWith('p1');
      expect(res).toEqual(
        expect.objectContaining({
          message: 'Payroll log details retrieved',
        }),
      );
    });

    it('should throw when employee is not owner', async () => {
      payrollService.getOnePayrollLog.mockResolvedValue({
        payroll_log_id: 'p1',
        employee_id: 'e2',
        employee: { company_id: 'c1', employee_id: 'e2' },
      });

      await expect(
        controller.getMyPayrollLogDetail(employeeReq('e1'), 'p1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
