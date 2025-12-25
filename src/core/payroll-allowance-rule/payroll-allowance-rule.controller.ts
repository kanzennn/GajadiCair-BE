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
import { PayrollAllowanceRuleService } from './payroll-allowance-rule.service';
import { CreatePayrollAllowanceRuleDto } from './dto/create-payroll-allowance-rule.dto';
import { UpdatePayrollAllowanceRuleDto } from './dto/update-payroll-allowance-rule.dto';
import { Request } from 'express';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { successResponse } from 'src/utils/response.utils';

@Controller({ path: 'company/payroll/allowance-rules', version: '1' })
@UseGuards(CompanyAuthGuard)
export class PayrollAllowanceRuleController {
  constructor(private readonly service: PayrollAllowanceRuleService) {}

  @Post()
  async create(
    @Req() req: Request & { user: TokenPayloadDto },
    @Body() dto: CreatePayrollAllowanceRuleDto,
  ) {
    const data = await this.service.create(req.user.sub, dto);
    return successResponse(data, 'Payroll allowance rule created');
  }

  @Get()
  async findAll(@Req() req: Request & { user: TokenPayloadDto }) {
    const data = await this.service.findAllByCompany(req.user.sub);
    return successResponse(data, 'Payroll allowance rules retrieved');
  }

  @Get(':payroll_allowance_rule_id')
  async findOne(
    @Req() req: Request & { user: TokenPayloadDto },
    @Param('payroll_allowance_rule_id') payroll_allowance_rule_id: string,
  ) {
    const data = await this.service.findOneByCompany(
      req.user.sub,
      payroll_allowance_rule_id,
    );
    return successResponse(data, 'Payroll allowance rule retrieved');
  }

  @Patch(':payroll_allowance_rule_id')
  async update(
    @Req() req: Request & { user: TokenPayloadDto },
    @Param('payroll_allowance_rule_id') payroll_allowance_rule_id: string,
    @Body() dto: UpdatePayrollAllowanceRuleDto,
  ) {
    const data = await this.service.updateByCompany(
      req.user.sub,
      payroll_allowance_rule_id,
      dto,
    );
    return successResponse(data, 'Payroll allowance rule updated');
  }

  @Delete(':payroll_allowance_rule_id')
  async remove(
    @Req() req: Request & { user: TokenPayloadDto },
    @Param('payroll_allowance_rule_id') payroll_allowance_rule_id: string,
  ) {
    const data = await this.service.removeByCompany(
      req.user.sub,
      payroll_allowance_rule_id,
    );
    return successResponse(data, 'Payroll allowance rule deleted');
  }
}
