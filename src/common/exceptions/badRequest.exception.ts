import { HttpException, HttpStatus } from '@nestjs/common';

export class BadRequestException extends HttpException {
  constructor(message: string = 'Bad Request') {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message,
        data: null,
        errors: {
          name: 'BAD_REQUEST',
          message,
          validationErrors: null,
        },
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
