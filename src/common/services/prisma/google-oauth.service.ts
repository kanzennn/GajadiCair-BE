import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

@Injectable()
export class GoogleOauthService {
  private client: OAuth2Client;
  private readonly googleClientId: string;

  constructor(private readonly configService: ConfigService) {
    this.googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID')!;

    this.client = new OAuth2Client(this.googleClientId);
  }

  async verifyToken(idToken: string): Promise<TokenPayload> {
    Logger.log(this.googleClientId);
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.googleClientId,
      });
      const payload = ticket.getPayload();
      if (!payload) {
        throw new Error('Invalid Google token');
      }

      return payload;
    } catch {
      throw new BadRequestException('Invalid Google token');
    }
  }
}
