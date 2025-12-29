import { IsDateString, IsString, MinLength, Validate } from 'class-validator';
import { IsEndDateAfterStartDate } from 'src/common/validators/end-after-start.validator';

export class CreateCustomHolidayDto {
  // format: YYYY-MM-DD
  @IsDateString({}, { message: 'start_date must be ISO date (YYYY-MM-DD)' })
  start_date: string;

  // format: YYYY-MM-DD
  @IsDateString({}, { message: 'end_date must be ISO date (YYYY-MM-DD)' })
  @Validate(IsEndDateAfterStartDate)
  end_date: string;

  @IsString()
  @MinLength(3, { message: 'description must be at least 3 characters long' })
  description: string;
}
