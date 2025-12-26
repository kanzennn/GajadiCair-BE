import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  name: string;

  @IsString()
  email: string;

  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsNumber()
  base_salary: number;

  @IsString()
  bank_id: string;

  @IsString()
  bank_account_number: string;

  @IsString()
  @IsOptional()
  tax_identification_number?: string;

  @IsBoolean()
  send_to_email?: boolean;
}
