import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { DashboardModule } from './core/dashboard/dashboard.module';
import redisConfig from './config/redis.config';
import { CacheModule } from '@nestjs/cache-manager';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, s3Config, mailerConfig, midtransConfig, redisConfig],
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
    DashboardModule,
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        const namespace = config.get<string>('APP_NAME');
        if (!redisUrl) throw new Error('REDIS_URL is required');

        return {
          ttl: 60_000,
          stores: [
            new Keyv({
              store: new KeyvRedis(redisUrl),
              namespace: `${namespace}-cache`,
            }),
          ],
        };
      },
    }),
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
