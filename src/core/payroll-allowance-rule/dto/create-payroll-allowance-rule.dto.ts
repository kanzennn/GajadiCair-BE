/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { IsString, IsNumber, Min, Max, ValidateIf } from 'class-validator';

export class CreatePayrollAllowanceRuleDto {
  @IsString()
  name: string;

  // kalau fixed_amount tidak diisi → percentage wajib
  @ValidateIf((o) => o.fixed_amount == null)
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage?: number;

  // kalau percentage tidak diisi → fixed_amount wajib
  @ValidateIf((o) => o.percentage == null)
  @IsNumber()
  @Min(0)
  fixed_amount?: number;
}
