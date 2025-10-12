import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  private appName: string;

  constructor(private configService: ConfigService) {
    this.appName = this.configService.get<string>('APP_NAME', 'My App');
  }

  getHello(): string {
    console.log(this.appName);
    return this.appName;
  }
}
