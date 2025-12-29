import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsString,
  Validate,
  ValidateIf,
} from 'class-validator';
import { HandUniqueWhenTwo } from 'src/common/validators/hand-unique-when-two.validator';
import { SameArrayLength } from 'src/common/validators/same-array-length.validator';

export class CheckOutDto {
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  latitude: string;

  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  longitude: string;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  @ValidateIf((o) => o.hand !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @IsString({ each: true })
  gesture?: string[];

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  @ValidateIf((o) => o.gesture !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @IsString({ each: true })
  @Validate(HandUniqueWhenTwo)
  @Validate(SameArrayLength, ['gesture'])
  hand?: string[];
}
