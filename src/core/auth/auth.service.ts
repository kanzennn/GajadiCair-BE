import { Injectable } from '@nestjs/common';
import { LoginAuthDto } from './dto/login-auth.dto';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { hash, verify } from 'argon2';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { GoogleOauthService } from 'src/common/services/google/google-oauth.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleOauthService: GoogleOauthService,
    private jwtService: JwtService,
  ) {}

  async login(credentials: LoginAuthDto) {
    const company = await this.prisma.company.findFirst({
      where: { email: credentials.email },
    });

    if (!company || !company?.password) {
      throw new BadRequestException('Invalid credentials');
    }

    const isPasswordValid = await verify(
      company.password,
      credentials.password,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid credentials');
    }

    await this.prisma.company.update({
      where: { company_id: company.company_id },
      data: { last_login: new Date() },
    });

    const payload = { sub: company.company_id, email: company.email };

    const access_token = await this.jwtService.signAsync(payload);

    const refresh_token = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
    });

    return {
      company: { ...company, password: undefined },
      access_token,
      refresh_token,
    };
  }

  async googleLogin(idToken: string) {
    const payload = await this.googleOauthService.verifyToken(idToken);

    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      throw new BadRequestException('Google account has no email');
    }

    const socialiteRecord = await this.prisma.companySocialite.findFirst({
      where: { socialite_id: googleId, socialite_name: 'google' },
      include: { company: true },
    });

    if (!socialiteRecord) {
      let company = await this.prisma.company.findFirst({
        where: { email },
      });

      if (!company) {
        company = await this.prisma.company.create({
          data: {
            email,
            name,
            avatar_uri: picture,
          },
        });
      }

      await this.prisma.companySocialite.create({
        data: {
          company_id: company.company_id,
          socialite_id: googleId,
          socialite_name: 'google',
        },
      });
    }

    const company = socialiteRecord?.company;
    const payloadJwt = { sub: company?.company_id, email: company?.email };

    const access_token = await this.jwtService.signAsync(payloadJwt);

    const refresh_token = await this.jwtService.signAsync(payloadJwt, {
      expiresIn: '7d',
    });

    return {
      company: { ...company, password: undefined },
      access_token,
      refresh_token,
    };
  }

  async register(registerAuthDto: RegisterAuthDto) {
    const existingcompany = await this.prisma.company.findFirst({
      where: { email: registerAuthDto.email },
    });

    if (existingcompany) throw new BadRequestException('Email already in use');

    const hashedPassword = await hash(registerAuthDto.password);
    const company = await this.prisma.company.create({
      data: {
        email: registerAuthDto.email,
        name: registerAuthDto.name,
        password: hashedPassword,
      },
    });

    const payload = { sub: company.company_id, email: company.email };

    const access_token = await this.jwtService.signAsync(payload);

    const refresh_token = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
    });

    return {
      company: { ...company, password: undefined },
      access_token,
      refresh_token,
    };
  }
}
