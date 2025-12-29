import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

import { CreatePayrollDeductionRuleDto } from './dto/create-payroll-deduction-rule.dto';
import { UpdatePayrollDeductionRuleDto } from './dto/update-payroll-deduction-rule.dto';

import { PayrollDeductionType } from 'generated/prisma';

type RulePayload = {
  type?: PayrollDeductionType;
  percentage?: number;
  fixed_amount?: number;
  per_minute?: boolean;
  max_minutes?: number;
};

@Injectable()
export class PayrollDeductionRuleService {
  constructor(private readonly prisma: PrismaService) {}

  // ===================== Public APIs =====================

  async create(companyId: string, dto: CreatePayrollDeductionRuleDto) {
    this.validateRule(dto);

    return this.prisma.payrollDeductionRule.create({
      data: {
        company_id: companyId,
        name: dto.name,
        type: dto.type,
        percentage: dto.percentage,
        fixed_amount: dto.fixed_amount,
        per_minute: dto.per_minute ?? false,
        max_minutes: dto.max_minutes,
        is_active: dto.is_active ?? true,
      },
    });
  }

  async findAllByCompany(companyId: string) {
    return this.prisma.payrollDeductionRule.findMany({
      where: { company_id: companyId, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOneByCompany(companyId: string, payroll_deduction_rule_id: string) {
    const rule = await this.prisma.payrollDeductionRule.findFirst({
      where: {
        payroll_deduction_rule_id,
        company_id: companyId,
        deleted_at: null,
      },
    });

    if (!rule)
      throw new BadRequestException('Payroll deduction rule not found');

    return rule;
  }

  async update(
    companyId: string,
    payroll_deduction_rule_id: string,
    dto: UpdatePayrollDeductionRuleDto,
  ) {
    await this.findOneByCompany(companyId, payroll_deduction_rule_id);
    this.validateRule(dto);

    return this.prisma.payrollDeductionRule.update({
      where: { payroll_deduction_rule_id },
      data: {
        name: dto.name,
        type: dto.type,
        percentage: dto.percentage,
        fixed_amount: dto.fixed_amount,
        per_minute: dto.per_minute,
        max_minutes: dto.max_minutes,
        is_active: dto.is_active,
      },
    });
  }

  async remove(companyId: string, payroll_deduction_rule_id: string) {
    await this.findOneByCompany(companyId, payroll_deduction_rule_id);

    return this.prisma.payrollDeductionRule.update({
      where: { payroll_deduction_rule_id },
      data: { deleted_at: new Date() },
    });
  }

  // ===================== Validators =====================

  private validateRule(dto: RulePayload) {
    // percentage XOR fixed_amount
    if (dto.percentage != null && dto.fixed_amount != null) {
      throw new BadRequestException(
        'Choose either percentage or fixed_amount, not both',
      );
    }

    // per_minute hanya valid untuk LATE
    if (dto.type === PayrollDeductionType.ABSENT && dto.per_minute) {
      throw new BadRequestException(
        'per_minute is only allowed for LATE deduction',
      );
    }
  }
}
