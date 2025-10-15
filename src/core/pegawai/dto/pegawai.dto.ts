import { PartialType } from '@nestjs/mapped-types';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsNumber,
  IsPositive,
  IsDate,
  IsNotEmpty,
  MinLength,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePegawaiDto {
  @IsString()
  @IsNotEmpty({ message: 'Name tidak boleh kosong' })
  name: string;

  @IsString()
  @IsUUID()
  company_id: string;

  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  password: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean = true;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'Salary harus lebih besar dari 0' })
  salary: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  created_at?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  updated_at?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  deleted_at?: Date;
}

export class UpdatePegawaiDto extends PartialType(CreatePegawaiDto) {}
