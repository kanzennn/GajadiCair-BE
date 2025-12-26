import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'HandUniqueWhenTwo', async: false })
export class HandUniqueWhenTwo implements ValidatorConstraintInterface {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  validate(hands: unknown, _args: ValidationArguments) {
    if (!Array.isArray(hands)) return false;

    // jika cuma 1 hand, tidak perlu unik
    if (hands.length !== 2) return true;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [h0, h1] = hands;

    return typeof h0 === 'string' && typeof h1 === 'string' && h0 !== h1;
  }

  defaultMessage() {
    return 'Jika hand dikirim 2 item, maka hand[0] dan hand[1] harus berbeda.';
  }
}
