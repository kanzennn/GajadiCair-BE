import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PayrollDeductionRuleService } from './payroll-deduction-rule.service';
import { CreatePayrollDeductionRuleDto } from './dto/create-payroll-deduction-rule.dto';
import { UpdatePayrollDeductionRuleDto } from './dto/update-payroll-deduction-rule.dto';
import { Request } from 'express';
import { TokenPayloadInterface } from '../auth/interfaces/token-payload.interface';
import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { successResponse } from 'src/utils/response.utils';

@Controller({ path: 'company/payroll/deduction-rules', version: '1' })
@UseGuards(CompanyAuthGuard)
export class PayrollDeductionRuleController {
  constructor(
    private readonly payrollDeductionRuleService: PayrollDeductionRuleService,
  ) {}

  @Post()
  async create(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Body() dto: CreatePayrollDeductionRuleDto,
  ) {
    const data = await this.payrollDeductionRuleService.create(
      req.user.sub,
      dto,
    );

    return successResponse(data, 'Payroll deduction rule created');
  }

  @Get()
  async findAll(@Req() req: Request & { user: TokenPayloadInterface }) {
    const data = await this.payrollDeductionRuleService.findAllByCompany(
      req.user.sub,
    );

    return successResponse(data, 'Payroll deduction rules retrieved');
  }

  @Get(':payroll_deduction_rule_id')
  async findOne(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Param('payroll_deduction_rule_id') payroll_deduction_rule_id: string,
  ) {
    const data = await this.payrollDeductionRuleService.findOneByCompany(
      req.user.sub,
      payroll_deduction_rule_id,
    );

    return successResponse(data, 'Payroll deduction rule retrieved');
  }

  @Patch(':payroll_deduction_rule_id')
  async update(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Param('payroll_deduction_rule_id') payroll_deduction_rule_id: string,
    @Body() dto: UpdatePayrollDeductionRuleDto,
  ) {
    const data = await this.payrollDeductionRuleService.update(
      req.user.sub,
      payroll_deduction_rule_id,
      dto,
    );

    return successResponse(data, 'Payroll deduction rule updated');
  }

  @Delete(':payroll_deduction_rule_id')
  async remove(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Param('payroll_deduction_rule_id') payroll_deduction_rule_id: string,
  ) {
    const data = await this.payrollDeductionRuleService.remove(
      req.user.sub,
      payroll_deduction_rule_id,
    );

    return successResponse(data, 'Payroll deduction rule deleted');
  }
}
