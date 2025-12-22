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
import { JwtEmployeeStrategy } from './strategies/jwt-employee.strategy';
import { S3Service } from 'src/common/services/s3/s3.service';

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
    JwtEmployeeStrategy,
    S3Service,
  ],
  exports: [JwtCompanyStrategy],
})
export class AuthModule {}
