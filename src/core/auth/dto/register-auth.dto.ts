import { IsEmail, IsString, Min } from 'class-validator';

export class RegisterAuthDto {
  @IsString()
  @Min(4)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @Min(6)
  password: string;
}
