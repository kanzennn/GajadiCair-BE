import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class CustomMailerService {
  private readonly logger = new Logger(CustomMailerService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendPlainEmail(to: string, subject: string, text: string) {
    try {
      await this.mailerService.sendMail({
        to,
        subject,
        text,
      });
      this.logger.log(`Email sent to ${to}`);
    } catch (err) {
      this.logger.error(
        'Failed to send email:',
        err instanceof Error ? err.message : String(err),
      );
      throw err;
    }
  }

  async sendTemplatedEmail(
    to: string,
    subject: string,
    template: string,
    context: Record<string, any>,
  ) {
    try {
      await this.mailerService.sendMail({
        to,
        subject,
        template, // nama file template di folder /templates
        context, // data yang dikirim ke template
      });
      this.logger.log(`Templated email sent to ${to}`);
    } catch (err) {
      this.logger.error(
        'Failed to send templated email:',
        err instanceof Error ? err.message : String(err),
      );
      throw err;
    }
  }
}
