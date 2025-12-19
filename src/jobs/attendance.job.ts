import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class DailyJobService {
  private readonly logger = new Logger(DailyJobService.name);

  @Cron('0 0 * * *', {
    timeZone: 'Asia/Jakarta',
  })
  async runEveryMidnight() {
    this.logger.log('Scheduler berjalan jam 00:00');
    // TODO: logic kamu
  }
}
