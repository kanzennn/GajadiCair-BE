import { Injectable } from '@nestjs/common';
import { LoginAuthDto } from './dto/login-auth.dto';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { hash, verify } from 'argon2';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { GoogleOauthService } from 'src/common/services/prisma/google-oauth.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleOauthService: GoogleOauthService,
    private jwtService: JwtService,
  ) {}

  async login(credentials: LoginAuthDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: credentials.email },
    });

    if (!user || !user.password) {
      throw new BadRequestException('Invalid credentials');
    }

    const isPasswordValid = await verify(user.password, credentials.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email };

    const access_token = await this.jwtService.signAsync(payload);

    const refresh_token = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
    });

    return {
      user: { ...user, password: undefined },
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

    const socialiteRecord = await this.prisma.userSocialite.findFirst({
      where: { socialite_id: googleId, socialite_name: 'google' },
      include: { user: true },
    });

    if (!socialiteRecord) {
      let user = await this.prisma.user.findFirst({
        where: { email },
      });

      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email,
            name,
            avatar_uri: picture,
          },
        });
      }

      await this.prisma.userSocialite.create({
        data: {
          user_id: user.id,
          socialite_id: googleId,
          socialite_name: 'google',
        },
      });
    }

    const user = socialiteRecord?.user;
    const payloadJwt = { sub: user?.id, email: user?.email };

    const access_token = await this.jwtService.signAsync(payloadJwt);

    const refresh_token = await this.jwtService.signAsync(payloadJwt, {
      expiresIn: '7d',
    });

    return {
      user: { ...user, password: undefined },
      access_token,
      refresh_token,
    };
  }

  async register(registerAuthDto: RegisterAuthDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: registerAuthDto.email },
    });

    if (existingUser) throw new BadRequestException('Email already in use');

    const hashedPassword = await hash(registerAuthDto.password);
    const user = await this.prisma.user.create({
      data: {
        email: registerAuthDto.email,
        name: registerAuthDto.name,
        password: hashedPassword,
      },
    });

    return { ...user, password: undefined };
  }
}
