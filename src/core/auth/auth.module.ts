import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthControllerV1 } from './auth.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { GoogleOauthService } from 'src/common/services/google/google-oauth.service';
import { JwtModule } from '@nestjs/jwt';
import { jwtConfig } from 'src/config/jwt.config';
import { JwtCompanyStrategy } from './strategies/jwt-company.strategy';
import { CompanyModule } from '../company/company.module';
import { EmployeeModule } from '../employee/employee.module';

@Module({
  imports: [
    CompanyModule,
    EmployeeModule,
    JwtModule.register({
      global: true,
      secret: jwtConfig.secret,
      signOptions: { expiresIn: jwtConfig.expiresIn },
    }),
  ],
  controllers: [AuthControllerV1],
  providers: [
    AuthService,
    PrismaService,
    GoogleOauthService,
    JwtCompanyStrategy,
  ],
  exports: [JwtCompanyStrategy],
})
export class AuthModule {}
