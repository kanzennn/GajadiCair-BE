import { Controller, Post, Body, Res, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginWithGoogleAuthDto } from './dto/login-with-google.dto';
import type { Response } from 'express';
import { successResponse } from 'src/utils/response.utils';

@Controller({ path: 'auth', version: '1' })
export class AuthControllerV1 {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() loginAuthDto: LoginAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { company, access_token, refresh_token } =
      await this.authService.login(loginAuthDto);

    res.setHeader('Authorization', `Bearer ${access_token}`);

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      // secure: process.env.NODE_ENV === 'production',
      secure: false,
      sameSite: 'none',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 hari
    });

    return successResponse(company, 'Login successful');
  }

  @Post('/login/google')
  async loginWithGoogle(
    @Body() loginWithGoogleAuthDto: LoginWithGoogleAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { company, access_token, refresh_token } =
      await this.authService.googleLogin(loginWithGoogleAuthDto.id_token);

    res.setHeader('Authorization', `Bearer ${access_token}`);

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      // secure: process.env.NODE_ENV === 'production',
      secure: false,
      sameSite: 'none',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 hari
    });

    return successResponse(company, 'Login successful');
  }

  @Post('register')
  async register(
    @Body() registerAuthDto: RegisterAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { company, access_token, refresh_token } =
      await this.authService.register(registerAuthDto);

    res.setHeader('Authorization', `Bearer ${access_token}`);

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      // secure: process.env.NODE_ENV === 'production',
      secure: false,
      sameSite: 'none',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 hari
    });

    return successResponse(company, 'Login successful', 201);
  }
}
