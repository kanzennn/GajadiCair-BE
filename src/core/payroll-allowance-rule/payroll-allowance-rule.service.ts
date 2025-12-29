import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { CompanyService } from '../company/company.service';
import { CreatePayrollAllowanceRuleDto } from './dto/create-payroll-allowance-rule.dto';
import { UpdatePayrollAllowanceRuleDto } from './dto/update-payroll-allowance-rule.dto';

@Injectable()
export class PayrollAllowanceRuleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyService: CompanyService,
  ) {}

  async create(companyId: string, dto: CreatePayrollAllowanceRuleDto) {
    const company = await this.companyService.getCompanyById(companyId);
    if (!company) throw new BadRequestException('Company not found');

    // validasi XOR
    if (
      (dto.percentage == null && dto.fixed_amount == null) ||
      (dto.percentage != null && dto.fixed_amount != null)
    ) {
      throw new BadRequestException(
        'Either percentage or fixed_amount must be filled (only one)',
      );
    }

    return this.prisma.payrollAllowanceRule.create({
      data: {
        company_id: companyId,
        name: dto.name.trim(),
        percentage: dto.percentage ?? null,
        fixed_amount: dto.fixed_amount ?? null,
      },
    });
  }

  async findAllByCompany(companyId: string) {
    return this.prisma.payrollAllowanceRule.findMany({
      where: {
        company_id: companyId,
        deleted_at: null,
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async findOneByCompany(companyId: string, payrollAllowanceRuleId: string) {
    const rule = await this.prisma.payrollAllowanceRule.findFirst({
      where: {
        payroll_allowance_rule_id: payrollAllowanceRuleId,
        company_id: companyId,
        deleted_at: null,
      },
    });

    if (!rule) {
      throw new BadRequestException('Payroll allowance rule not found');
    }

    return rule;
  }

  async updateByCompany(
    companyId: string,
    payrollAllowanceRuleId: string,
    dto: UpdatePayrollAllowanceRuleDto,
  ) {
    const existing = await this.findOneByCompany(
      companyId,
      payrollAllowanceRuleId,
    );

    // validasi XOR
    if (
      (dto.percentage == null && dto.fixed_amount == null) ||
      (dto.percentage != null && dto.fixed_amount != null)
    ) {
      throw new BadRequestException(
        'Either percentage or fixed_amount must be filled (only one)',
      );
    }

    return this.prisma.payrollAllowanceRule.update({
      where: {
        payroll_allowance_rule_id: existing.payroll_allowance_rule_id,
      },
      data: {
        name: dto.name.trim(),
        percentage: dto.percentage ?? null,
        fixed_amount: dto.fixed_amount ?? null,
        is_active: dto.is_active,
      },
    });
  }

  async removeByCompany(companyId: string, payrollAllowanceRuleId: string) {
    const existing = await this.findOneByCompany(
      companyId,
      payrollAllowanceRuleId,
    );

    return this.prisma.payrollAllowanceRule.update({
      where: {
        payroll_allowance_rule_id: existing.payroll_allowance_rule_id,
      },
      data: {
        deleted_at: new Date(),
      },
    });
  }
}
