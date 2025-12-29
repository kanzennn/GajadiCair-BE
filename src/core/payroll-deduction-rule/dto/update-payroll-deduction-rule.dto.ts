/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { PayrollDeductionType } from 'generated/prisma';

export class UpdatePayrollDeductionRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(PayrollDeductionType)
  type?: PayrollDeductionType;

  @ValidateIf((o) => o.fixed_amount === undefined)
  @IsOptional()
  @IsNumber()
  @Min(0)
  percentage?: number;

  @ValidateIf((o) => o.percentage === undefined)
  @IsOptional()
  @IsNumber()
  @Min(0)
  fixed_amount?: number;

  @IsOptional()
  @IsBoolean()
  per_minute?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  max_minutes?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
