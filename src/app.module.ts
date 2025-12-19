import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import s3Config from './config/s3.config';
import { AuthModule } from './core/auth/auth.module';
import { LoggerMiddleware } from './common/middleware/logger/logger.middleware';
import { CompanyModule } from './core/company/company.module';
import { EmployeeModule } from './core/employee/employee.module';
import { BankModule } from './core/bank/bank.module';
import { FaceRecognitionModule } from './core/face-recognition/face-recognition.module';
import { SubscriptionModule } from './core/subscription/subscription.module';
import mailerConfig from './config/mailer.config';
import midtransConfig from './config/midtrans.config';
import { MidtransModule } from './common/services/midtrans/midtrans.module';
import { AttendanceModule } from './core/attendance/attendance.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, s3Config, mailerConfig, midtransConfig],
    }),
    AuthModule,
    CompanyModule,
    EmployeeModule,
    BankModule,
    FaceRecognitionModule,
    SubscriptionModule,
    MidtransModule,
    AttendanceModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes({
      path: '/*',
      method: RequestMethod.ALL,
    });
  }
}
