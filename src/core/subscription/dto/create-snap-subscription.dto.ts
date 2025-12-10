import { IsIn } from 'class-validator';

export class CreateSnapSubscriptionDto {
  @IsIn([1, 2], { message: 'level_plan must be one of: 1, 2' })
  level_plan: number;
}
