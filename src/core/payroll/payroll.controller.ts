import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { successResponse } from 'src/utils/response.utils';
import { TokenPayloadInterface } from '../auth/interfaces/token-payload.interface';

import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { EmployeeAuthGuard } from '../auth/guards/employee.guard';

import { PayrollService } from './payroll.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

@Controller({ version: '1' })
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  // ===================== COMPANY =====================

  @Get('company/payroll/summary')
  @UseGuards(CompanyAuthGuard)
  async getCompanyPayrollSummary(
    @Req() req: Request & { user: TokenPayloadInterface },
  ) {
    const data = await this.payrollService.getCompanyPayrollSummary(
      req.user.sub,
    );
    return successResponse(data, 'Company payroll summary retrieved');
  }

  @Get('company/payroll/history')
  @UseGuards(CompanyAuthGuard)
  async getCompanyPayrollHistory(
    @Req() req: Request & { user: TokenPayloadInterface },
  ) {
    const data = await this.payrollService.getAllPayrollLogByCompany(
      req.user.sub,
    );
    return successResponse(data, 'Payroll history retrieved');
  }

  @Get('company/payroll/history/:payroll_log_id')
  @UseGuards(CompanyAuthGuard)
  async getCompanyPayrollLogDetail(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Param('payroll_log_id') payroll_log_id: string,
  ) {
    const data = await this.payrollService.getOnePayrollLog(payroll_log_id);

    if (data.employee?.company_id !== req.user.sub) {
      throw new BadRequestException(
        'Unauthorized access to payroll log details',
      );
    }

    return successResponse(data, 'Payroll log details retrieved');
  }

  // ===================== EMPLOYEE =====================

  @Get('employee/payroll/summary')
  @UseGuards(EmployeeAuthGuard)
  async getMyPayrollSummary(
    @Req() req: Request & { user: TokenPayloadInterface },
  ) {
    const data = await this.payrollService.getEmployeePayroll(req.user.sub);
    return successResponse(data, 'Payroll summary retrieved');
  }

  @Get('employee/payroll/history')
  @UseGuards(EmployeeAuthGuard)
  async getMyPayrollHistory(
    @Req() req: Request & { user: TokenPayloadInterface },
  ) {
    const data = await this.payrollService.getAllPayrollLogByEmployee(
      req.user.sub,
    );
    return successResponse(data, 'Payroll history retrieved');
  }

  @Get('employee/payroll/history/:payroll_log_id')
  @UseGuards(EmployeeAuthGuard)
  async getMyPayrollLogDetail(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Param('payroll_log_id') payroll_log_id: string,
  ) {
    const data = await this.payrollService.getOnePayrollLog(payroll_log_id);

    // NOTE: di service kamu, getOnePayrollLog include `employee` tapi belum pasti include `employee_id` top-level.
    // Paling aman cek dua-duanya.
    const ownerEmployeeId = data.employee_id ?? data.employee?.employee_id;

    if (ownerEmployeeId !== req.user.sub) {
      throw new BadRequestException(
        'Unauthorized access to payroll log details',
      );
    }

    return successResponse(data, 'Payroll log details retrieved');
  }
}
