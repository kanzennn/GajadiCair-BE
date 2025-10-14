import { IsString, MinLength } from 'class-validator';

export class LoginWithGoogleAuthDto {
  @IsString()
  @MinLength(1)
  id_token: string;
}
