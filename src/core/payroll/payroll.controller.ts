import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { PayrollService } from './payroll.service';
import { successResponse } from 'src/utils/response.utils';
import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { EmployeeAuthGuard } from '../auth/guards/employee.guard';

@Controller({ version: '1' })
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}
  @Get('company/payroll/summary')
  @UseGuards(CompanyAuthGuard)
  async getCompanyPayroll(@Req() req: Request & { user: TokenPayloadDto }) {
    const data = await this.payrollService.getCompanyPayrollSummary(
      req.user.sub,
    );

    return successResponse(data, 'Company payroll summary retrieved');
  }

  @Get('employee/payroll/summary')
  @UseGuards(EmployeeAuthGuard)
  async getMyPayroll(@Req() req: Request & { user: TokenPayloadDto }) {
    const data = await this.payrollService.getEmployeePayroll(req.user.sub);
    return successResponse(data, 'Payroll summary retrieved');
  }
}
