import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { TokenPayloadInterface } from '../auth/interfaces/token-payload.interface';
import { PayrollService } from './payroll.service';
import { successResponse } from 'src/utils/response.utils';
import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { EmployeeAuthGuard } from '../auth/guards/employee.guard';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

@Controller({ version: '1' })
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}
  @Get('company/payroll/summary')
  @UseGuards(CompanyAuthGuard)
  async getCompanyPayroll(@Req() req: Request & { user: TokenPayloadInterface }) {
    const data = await this.payrollService.getCompanyPayrollSummary(
      req.user.sub,
    );

    return successResponse(data, 'Company payroll summary retrieved');
  }

  @Get('company/payroll/history')
  @UseGuards(CompanyAuthGuard)
  async getEmployeePayroll(@Req() req: Request & { user: TokenPayloadInterface }) {
    const data = await this.payrollService.getAllPayrollLogByCompany(
      req.user.sub,
    );
    return successResponse(data, 'Payroll history retrieved');
  }

  @Get('company/payroll/history/:payroll_log_id')
  @UseGuards(CompanyAuthGuard)
  async getPayrollLogDetails(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Param('payroll_log_id') payroll_log_id: string,
  ) {
    const data = await this.payrollService.getOnePayrollLog(payroll_log_id);
    if (data.employee.company_id !== req.user.sub) {
      throw new BadRequestException(
        'Unauthorized access to payroll log details',
      );
    }
    return successResponse(data, 'Payroll log details retrieved');
  }

  @Get('employee/payroll/summary')
  @UseGuards(EmployeeAuthGuard)
  async getMyPayroll(@Req() req: Request & { user: TokenPayloadInterface }) {
    const data = await this.payrollService.getEmployeePayroll(req.user.sub);
    return successResponse(data, 'Payroll summary retrieved');
  }

  @Get('employee/payroll/history')
  @UseGuards(EmployeeAuthGuard)
  async getPayrollByEmployee(@Req() req: Request & { user: TokenPayloadInterface }) {
    console.log(req.user.sub);
    const data = await this.payrollService.getAllPayrollLogByEmployee(
      req.user.sub,
    );
    return successResponse(data, 'Payroll history retrieved');
  }

  @Get('employee/payroll/history/:payroll_log_id')
  @UseGuards(EmployeeAuthGuard)
  async getPayrollLogDetailsByEmployee(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Param('payroll_log_id') payroll_log_id: string,
  ) {
    const data = await this.payrollService.getOnePayrollLog(payroll_log_id);
    if (data.employee_id !== req.user.sub) {
      throw new BadRequestException(
        'Unauthorized access to payroll log details',
      );
    }
    return successResponse(data, 'Payroll log details retrieved');
  }
}
