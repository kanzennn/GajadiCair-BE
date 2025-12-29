import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import {
  Logger,
  VersioningType,
  UnprocessableEntityException,
  ValidationPipe,
} from '@nestjs/common';
import appConfig from './config/app.config';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.setGlobalPrefix('api');

  app.enableVersioning({
    type: VersioningType.URI,
  });

  const whiteList: string[] = [
    'http://localhost:3000',
    'https://gajadicairbrooo.netlify.app',
    'http://localhost:5173',
  ];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || whiteList.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) => {
        const formattedErrors = errors.map((err) => ({
          field: err.property,
          messages: Object.values(err.constraints || {}),
        }));

        return new UnprocessableEntityException({
          statusCode: 422,
          message: 'Validation Error',
          data: null,
          errors: {
            name: 'VALIDATION_ERROR',
            message: null,
            validationErrors: formattedErrors,
          },
        });
      },
    }),
  );

  app.use(cookieParser());
  app.use(helmet());
  await app.listen(appConfig().APP_PORT ?? 3000);
  const logger = new Logger();
  logger.log(`This app running at port ${appConfig().APP_PORT}`);
}

void bootstrap();
