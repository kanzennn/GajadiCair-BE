import { IsString } from 'class-validator';

export class UpdateProfileEmployeeDto {
  @IsString()
  name: string;

  avatar_uri?: string;
}
