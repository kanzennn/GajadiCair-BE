import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'IsStartDateAfterToday', async: false })
export class IsStartDateAfterToday implements ValidatorConstraintInterface {
  validate(start_date: string) {
    if (!start_date) return true;

    // normalize ke DATE (tanpa jam)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(start_date);
    startDate.setHours(0, 0, 0, 0);

    // start_date harus > hari ini
    return startDate > today;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  defaultMessage(args: ValidationArguments) {
    return 'start_date must be greater than today';
  }
}
