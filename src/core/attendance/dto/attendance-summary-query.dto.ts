import { IsDateString, IsOptional, Validate } from 'class-validator';
import { IsEndDateAfterStartDate } from 'src/common/validators/end-after-start.validator';

export class AttendanceSummaryQueryDto {
  @IsOptional()
  @IsDateString({}, { message: 'start_date must be ISO date (YYYY-MM-DD)' })
  start_date?: string;

  @IsOptional()
  @IsDateString({}, { message: 'end_date must be ISO date (YYYY-MM-DD)' })
  @Validate(IsEndDateAfterStartDate) // pastikan validator kamu support query ini
  end_date?: string;
}
