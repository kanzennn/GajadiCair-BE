import { IsInt, Min, Max, IsOptional } from 'class-validator';

export class CreateSnapSubscriptionDto {
  @IsInt()
  @Min(0)
  @Max(2)
  level_plan: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  duration_months?: number; // untuk extend / renew
}
