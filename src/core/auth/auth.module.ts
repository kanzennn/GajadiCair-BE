import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthControllerV1 } from './auth.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { GoogleOauthService } from 'src/common/services/prisma/google-oauth.service';
import { JwtModule } from '@nestjs/jwt';
import { jwtConfig } from 'src/config/jwt.config';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: jwtConfig.secret,
      signOptions: { expiresIn: jwtConfig.expiresIn },
    }),
  ],
  controllers: [AuthControllerV1],
  providers: [AuthService, PrismaService, GoogleOauthService],
})
export class AuthModule {}
