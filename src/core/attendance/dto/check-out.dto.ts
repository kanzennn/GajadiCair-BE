import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsNumber } from 'class-validator';

export class CheckOutDto {
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  latitude: string;

  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  longitude: string;
}
