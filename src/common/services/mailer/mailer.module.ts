import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'node:path';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { CustomMailerService } from './mailer.service';

@Module({
  imports: [
    ConfigModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get<string>('MAILER_HOST'),
          port: config.get<number>('MAILER_PORT'),
          secure: config.get<boolean>('MAILER_SECURE'),
          auth: {
            user: config.get<string>('MAILER_USER'),
            pass: config.get<string>('MAILER_PASSWORD'),
          },
          tls: {
            rejectUnauthorized: config.get<boolean>(
              'MAILER_TLS_REJECT_UNAUTHORIZED',
            ),
          },
        },
        defaults: {
          from: config.get<string>('MAILER_FROM'),
        },
        template: {
          dir: path.join(__dirname, 'templates'),
          adapter: new HandlebarsAdapter(), // Bisa diganti EjsAdapter() kalau pakai EJS
          options: {
            strict: true,
          },
        },
      }),
    }),
  ],
  providers: [CustomMailerService],
  exports: [CustomMailerService],
})
export class CustomMailerModule {}
