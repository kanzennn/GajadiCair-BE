/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { parseTimeToMinutes } from 'src/utils/date.utils';

@ValidatorConstraint({ name: 'ToleranceWithinWindow', async: false })
export class ToleranceWithinWindowValidator
  implements ValidatorConstraintInterface
{
  validate(_: unknown, args: ValidationArguments): boolean {
    const o = args.object as any;

    // Only validate if tolerance + work_start_time + close_time are provided
    if (
      o.attendance_tolerance_minutes === undefined ||
      !o.work_start_time ||
      !o.attendance_close_time
    ) {
      return true;
    }

    const work = parseTimeToMinutes(o.work_start_time);
    const close = parseTimeToMinutes(o.attendance_close_time);

    if (work == null || close == null) return true;

    const windowMinutes = close - work;

    // If window is invalid (<=0), let TimeOrderValidator handle it (or skip)
    if (windowMinutes <= 0) return true;

    const tol = Number(o.attendance_tolerance_minutes);
    if (Number.isNaN(tol)) return true;

    return tol < windowMinutes;
  }

  defaultMessage(): string {
    return 'attendance_tolerance_minutes must be less than (attendance_close_time - work_start_time)';
  }
}
