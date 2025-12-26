import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'SameArrayLength', async: false })
export class SameArrayLength implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments) {
    const [otherProp] = args.constraints as [string];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const obj = args.object as any;

    const a = value as any[];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const b = obj?.[otherProp] as any[];

    if (!Array.isArray(a) || !Array.isArray(b)) return true; // biar ValidateIf yang handle
    return a.length === b.length;
  }

  defaultMessage(args: ValidationArguments) {
    const [otherProp] = args.constraints as [string];
    return `${args.property} length must be the same as ${otherProp} length`;
  }
}
