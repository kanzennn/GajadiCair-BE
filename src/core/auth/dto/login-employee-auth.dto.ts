import { IsString } from 'class-validator';

export class LoginEmployeeAuthDto {
  @IsString()
  company_identifier: string;

  @IsString()
  username: string;

  @IsString()
  password: string;
}
