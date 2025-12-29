/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { parseTimeToMinutes } from 'src/utils/date.utils';

@ValidatorConstraint({ name: 'AttendanceTimeOrder', async: false })
export class AttendanceTimeOrderValidator
  implements ValidatorConstraintInterface
{
  validate(_: unknown, args: ValidationArguments): boolean {
    const o = args.object as any;

    // Only validate if all 3 times are provided in this request
    if (
      !o.attendance_open_time ||
      !o.work_start_time ||
      !o.attendance_close_time
    ) {
      return true;
    }

    const open = parseTimeToMinutes(o.attendance_open_time);
    const work = parseTimeToMinutes(o.work_start_time);
    const close = parseTimeToMinutes(o.attendance_close_time);

    // format already checked by @Matches, so just skip if parse failed
    if (open == null || work == null || close == null) return true;

    return open < work && work <= close;
  }

  defaultMessage(): string {
    return 'attendance_open_time must be < work_start_time and work_start_time must be <= attendance_close_time';
  }
}
