import { IsString, MinLength } from 'class-validator';
import { Match } from 'src/common/validators/match.validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  old_password: string;

  @IsString()
  @MinLength(6)
  new_password: string;

  @IsString()
  @Match('new_password', {
    message: 'confirm_password must match new_password',
  })
  confirm_password: string;
}
