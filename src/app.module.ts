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
import { S3Module } from './common/services/s3/s3.module';
import { LeaveApplicationModule } from './core/leave-application/leave-application.module';
import { WorkingDayModule } from './core/working-day/working-day.module';
import { CustomHolidayModule } from './core/custom-holiday/custom-holiday.module';
import { PayrollModule } from './core/payroll/payroll.module';
import { PayrollAllowanceRuleModule } from './core/payroll-allowance-rule/payroll-allowance-rule.module';
import { PayrollDeductionRuleModule } from './core/payroll-deduction-rule/payroll-deduction-rule.module';
import { JobsModule } from './jobs/job.module';

@Module({
  imports: [
    // ================= CONFIG =================
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, s3Config, mailerConfig, midtransConfig, redisConfig],
    }),

    // ================= CORE MODULES =================
    AuthModule,
    CompanyModule,
    EmployeeModule,
    BankModule,
    FaceRecognitionModule,
    SubscriptionModule,
    AttendanceModule,
    DashboardModule,
    LeaveApplicationModule,
    WorkingDayModule,
    CustomHolidayModule,

    // ================= PAYROLL =================
    PayrollModule,
    PayrollAllowanceRuleModule,
    PayrollDeductionRuleModule,

    // ================= SERVICES =================
    MidtransModule,
    S3Module,

    // ================= JOBS & SCHEDULER =================
    ScheduleModule.forRoot(), // ⬅️ WAJIB
    JobsModule, // ⬅️ INI YANG KAMU KURANG

    // ================= CACHE =================
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
