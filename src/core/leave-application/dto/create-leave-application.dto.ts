import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Validate,
} from 'class-validator';
import { IsEndDateAfterStartDate } from 'src/common/validators/end-after-start.validator';

export class CreateLeaveApplicationDto {
  // format: YYYY-MM-DD
  @IsDateString({}, { message: 'start_date must be ISO date (YYYY-MM-DD)' })
  start_date: string;

  // format: YYYY-MM-DD
  @IsDateString({}, { message: 'end_date must be ISO date (YYYY-MM-DD)' })
  @Validate(IsEndDateAfterStartDate)
  end_date: string;

  @IsString()
  reason: string;

  @IsEnum(
    {
      LEAVE: 'LEAVE',
      SICK: 'SICK',
    },
    {
      message: 'type must be either LEAVE or SICK',
    },
  )
  type: string;

  @IsOptional()
  @IsString()
  attachment_uri?: string;
}
