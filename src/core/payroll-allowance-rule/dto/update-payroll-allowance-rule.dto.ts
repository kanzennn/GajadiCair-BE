/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  IsString,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  ValidateIf,
} from 'class-validator';

export class UpdatePayrollAllowanceRuleDto {
  @IsString()
  name: string;

  @ValidateIf((o) => o.fixed_amount == null)
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage?: number;

  @ValidateIf((o) => o.percentage == null)
  @IsNumber()
  @Min(0)
  fixed_amount?: number;

  @IsBoolean()
  is_active: boolean;
}
