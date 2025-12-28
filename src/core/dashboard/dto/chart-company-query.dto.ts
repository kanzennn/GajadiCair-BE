import {
  IsOptional,
  IsInt,
  Min,
  IsDateString,
  Validate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsEndDateAfterStartDate } from 'src/common/validators/end-after-start.validator';

export class ChartCompanyQueryDto {
  // YYYY-MM-DD
  @IsOptional()
  @IsDateString({}, { message: 'start_date must be ISO date (YYYY-MM-DD)' })
  start_date?: string;

  // YYYY-MM-DD
  @IsOptional()
  @IsDateString({}, { message: 'end_date must be ISO date (YYYY-MM-DD)' })
  @Validate(IsEndDateAfterStartDate)
  end_date?: string;

  // jumlah hari ke belakang (7, 30, 90, dst)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days?: number;
}
