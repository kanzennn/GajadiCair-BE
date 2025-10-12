import { IsString } from 'class-validator';

export class LoginWithGoogleAuthDto {
  @IsString()
  id_token: string;
}
