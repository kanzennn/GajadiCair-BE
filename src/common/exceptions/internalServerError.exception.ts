import { HttpException, HttpStatus } from '@nestjs/common';

export class InternalServerErrorException extends HttpException {
  constructor(message: string = 'Internal Server Error') {
    super(
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message,
        data: null,
        errors: {
          name: 'INTERNAL_SERVER_ERROR',
          message,
          validationErrors: null,
        },
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
