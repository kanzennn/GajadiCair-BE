/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
  Validate,
  ValidateIf,
} from 'class-validator';
import { AttendanceTimeOrderValidator } from 'src/common/validators/attendance-time-order.validator';
import { ToleranceWithinWindowValidator } from 'src/common/validators/tolerance-within-window.validator';

export class UpdateAttendanceSettingDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24)
  minimum_hours_per_day?: number;

  // format "HH:mm" atau "HH:mm:ss"
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'attendance_open_time must be in HH:mm or HH:mm:ss format',
  })
  attendance_open_time?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'attendance_close_time must be in HH:mm or HH:mm:ss format',
  })
  attendance_close_time?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'work_start_time must be in HH:mm or HH:mm:ss format',
  })
  // ✅ Rule #1: open < work <= close
  @Validate(AttendanceTimeOrderValidator)
  // ✅ Rule #2: tolerance < (close - work)
  @Validate(ToleranceWithinWindowValidator)
  work_start_time?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  attendance_tolerance_minutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  payroll_day_of_month?: number;

  @IsOptional()
  @IsBoolean()
  attendance_location_enabled?: boolean;

  // radius wajib kalau location enabled = true
  @ValidateIf((o) => o.attendance_location_enabled === true)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  attendance_radius_meters?: number;

  // lat/lng wajib kalau location enabled = true
  @ValidateIf((o) => o.attendance_location_enabled === true)
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  latitude?: number;

  @ValidateIf((o) => o.attendance_location_enabled === true)
  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  longitude?: number;
}
