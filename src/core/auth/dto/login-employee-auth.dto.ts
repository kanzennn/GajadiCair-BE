import { IsString } from 'class-validator';

export class LoginEmployeeAuthDto {
  @IsString()
  company_id: string;

  @IsString()
  employee_id: string;

  @IsString()
  password: string;
}
