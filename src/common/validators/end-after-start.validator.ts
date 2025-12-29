/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'IsEndDateAfterStartDate', async: false })
export class IsEndDateAfterStartDate implements ValidatorConstraintInterface {
  validate(end_date: string, args: ValidationArguments) {
    const obj = args.object as any;
    if (!obj.start_date || !end_date) return true;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return new Date(end_date) >= new Date(obj.start_date);
  }

  defaultMessage() {
    return 'end_date must be greater than or equal to start_date';
  }
}
