import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const clientIp = (
      req.headers['x-forwarded-for'] ||
      req.socket.remoteAddress ||
      ''
    )
      .toString()
      .replace('::1', '127.0.0.1');

    Logger.log(`Request... ${req.method} ${req.originalUrl} from ${clientIp}`);

    res.on('finish', () => {
      const duration = Date.now() - start;
      Logger.log(
        `Response... ${req.method} ${req.originalUrl} ${res.statusCode} from ${clientIp} - ${duration}ms`,
      );
    });

    next();
  }
}
