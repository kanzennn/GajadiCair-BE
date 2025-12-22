import { IsBoolean, IsString } from 'class-validator';

export class UpdateStatusLeaveApplicationDto {
  @IsString()
  employee_leave_application_id?: string;

  @IsBoolean()
  is_approve: boolean;
}
