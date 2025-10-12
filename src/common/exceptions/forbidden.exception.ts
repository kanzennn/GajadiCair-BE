import { HttpException, HttpStatus } from '@nestjs/common';

export class ForbiddenException extends HttpException {
  constructor(message: string = 'Forbidden') {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        message,
        data: null,
        errors: {
          name: 'FORBIDDEN',
          message,
          validationErrors: null,
        },
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
