import { IsNumberString, IsString } from 'class-validator';

export class CreateBankDto {
  @IsString()
  name: string;

  @IsNumberString()
  code: string;
}
