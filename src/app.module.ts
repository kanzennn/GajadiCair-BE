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
import { PegawaiModule } from './core/pegawai/pegawai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, s3Config],
    }),
    AuthModule,
    PegawaiModule,
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
