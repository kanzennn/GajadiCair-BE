import { IsBoolean } from 'class-validator';

export class UpdateWorkingDayDto {
  @IsBoolean()
  monday: boolean;

  @IsBoolean()
  tuesday: boolean;

  @IsBoolean()
  wednesday: boolean;

  @IsBoolean()
  thursday: boolean;

  @IsBoolean()
  friday: boolean;

  @IsBoolean()
  saturday: boolean;

  @IsBoolean()
  sunday: boolean;
}
