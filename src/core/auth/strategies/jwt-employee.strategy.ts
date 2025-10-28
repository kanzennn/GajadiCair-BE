import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { jwtConfig } from 'src/config/jwt.config';
import { TokenPayloadDto } from '../dto/token-payload.dto';

@Injectable()
export class JwtEmployeeStrategy extends PassportStrategy(
  Strategy,
  'jwt-employee',
) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtConfig.secret,
    });
  }

  async validate(payload: TokenPayloadDto) {
    if (payload.role !== 'employee') return await Promise.resolve(null);
    return await Promise.resolve(payload);
  }
}
