// src/utils/response.util.ts
import { HttpStatus } from '@nestjs/common';

export interface IErrorResponse {
  name: string;
  message: string;
  validationErrors?: any;
}

export function successResponse<T>(
  data: T,
  message: string = 'Success',
  statusCode: number = HttpStatus.OK,
) {
  return {
    statusCode,
    message,
    data,
    errors: null,
  };
}
