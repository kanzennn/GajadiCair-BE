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

export class CreatePayrollDeductionRuleDto {
  @IsString()
  name: string;

  @IsEnum(PayrollDeductionType)
  type: PayrollDeductionType; // LATE | ABSENT

  // salah satu saja
  @ValidateIf((o) => o.fixed_amount === undefined)
  @IsNumber()
  @Min(0)
  percentage?: number;

  @ValidateIf((o) => o.percentage === undefined)
  @IsNumber()
  @Min(0)
  fixed_amount?: number;

  // khusus LATE
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
