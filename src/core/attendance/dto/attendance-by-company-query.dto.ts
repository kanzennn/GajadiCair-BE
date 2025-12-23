import { IsDateString, IsOptional } from 'class-validator';

export class AttendanceByCompanyQueryDto {
  @IsOptional()
  @IsDateString({}, { message: 'start_date must be ISO date (YYYY-MM-DD)' })
  date?: string;
}
