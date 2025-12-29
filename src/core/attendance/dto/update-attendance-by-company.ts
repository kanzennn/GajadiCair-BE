import {
  IsUUID,
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsInt,
  Min,
  IsString,
} from 'class-validator';
import { AttendanceStatus } from 'generated/prisma';

export class UpdateAttendanceByCompanyDto {
  @IsUUID()
  employee_attendance_id: string;

  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @IsOptional()
  @IsDateString()
  check_in_time?: string;

  @IsOptional()
  @IsDateString()
  check_out_time?: string;

  @IsOptional()
  @IsBoolean()
  is_late?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  late_minutes?: number;

  @IsOptional()
  @IsString()
  absent_reason?: string;
}
