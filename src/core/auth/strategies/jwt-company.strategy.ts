import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { jwtConfig } from 'src/config/jwt.config';
import { TokenPayloadInterface } from '../interfaces/token-payload.interface';

@Injectable()
export class JwtCompanyStrategy extends PassportStrategy(
  Strategy,
  'jwt-company',
) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtConfig.secret,
    });
  }

  async validate(payload: TokenPayloadInterface) {
    if (payload.role !== 'company') return await Promise.resolve(null);
    return await Promise.resolve(payload);
  }
}
