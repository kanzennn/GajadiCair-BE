import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  private readonly appName: string;

  constructor() {}

  getHello(): string {
    return 'Hello world!';
  }
}
