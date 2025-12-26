import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { successResponse } from 'src/utils/response.utils';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

import { CompanyAuthGuard } from './guards/company.guard';
import { EmployeeAuthGuard } from './guards/employee.guard';
import { TokenPayloadDto } from './dto/token-payload.dto';

import { LoginAuthDto } from './dto/login-auth.dto';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginWithGoogleAuthDto } from './dto/login-with-google.dto';
import { LoginEmployeeAuthDto } from './dto/login-employee-auth.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller({ path: 'auth', version: '1' })
export class AuthControllerV1 {
  constructor(private readonly authService: AuthService) {}

  // ===================== Helpers =====================
  private setRefreshTokenCookie(res: Response, refreshToken: string) {
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      // secure: process.env.NODE_ENV === 'production',
      secure: false,
      sameSite: 'none',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 hari (detik)
    });
  }

  private getRefreshToken(req: Request): string {
    const refreshToken = req.cookies?.['refresh_token'] as string | undefined;
    if (!refreshToken) throw new BadRequestException('Refresh token not found');
    return refreshToken;
  }

  // ===================== COMPANY =====================
  @Post('company/login')
  @HttpCode(200)
  async loginCompany(
    @Body() dto: LoginAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { company, access_token, refresh_token } =
      await this.authService.loginCompany(dto);

    this.setRefreshTokenCookie(res, refresh_token);

    return successResponse({ company, access_token }, 'Login successful');
  }

  @Post('company/login/google')
  @HttpCode(200)
  async loginWithGoogleCompany(
    @Body() dto: LoginWithGoogleAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { company, access_token, refresh_token } =
      await this.authService.googleLoginCompany(dto.id_token);

    this.setRefreshTokenCookie(res, refresh_token);

    return successResponse({ company, access_token }, 'Login successful');
  }

  @Post('company/register')
  @HttpCode(201)
  async registerCompany(
    @Body() dto: RegisterAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { company, access_token, refresh_token } =
      await this.authService.registerCompany(dto);

    this.setRefreshTokenCookie(res, refresh_token);

    return successResponse(
      { company, access_token },
      'Register successful',
      201,
    );
  }

  @Put('company/change-password')
  @HttpCode(200)
  @UseGuards(CompanyAuthGuard)
  async changeCompanyPassword(
    @Req() req: Request & { user: TokenPayloadDto },
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changeCompanyPassword(
      req.user.sub,
      dto.old_password,
      dto.new_password,
    );

    return successResponse(null, 'Password changed successfully');
  }

  @Get('company/refresh-token')
  @HttpCode(200)
  async refreshCompanyToken(@Req() req: Request) {
    const refreshToken = this.getRefreshToken(req);

    const { access_token } =
      await this.authService.refreshCompanyToken(refreshToken);

    return successResponse({ access_token }, 'Token refreshed successfully');
  }

  // ===================== EMPLOYEE =====================
  @Post('employee/login')
  @HttpCode(200)
  async loginEmployee(
    @Body() dto: LoginEmployeeAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { employee, access_token, refresh_token } =
      await this.authService.loginEmployee(dto);

    this.setRefreshTokenCookie(res, refresh_token);

    return successResponse({ employee, access_token }, 'Login successful');
  }

  @Put('employee/change-password')
  @HttpCode(200)
  @UseGuards(EmployeeAuthGuard) // ✅ FIX: sebelumnya CompanyAuthGuard
  async changeEmployeePassword(
    @Req() req: Request & { user: TokenPayloadDto },
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changeEmployeePassword(
      req.user.sub,
      dto.old_password,
      dto.new_password,
    );

    return successResponse(null, 'Password changed successfully');
  }

  @Get('employee/refresh-token')
  @HttpCode(200)
  async refreshEmployeeToken(@Req() req: Request) {
    const refreshToken = this.getRefreshToken(req);

    const { access_token } =
      await this.authService.refreshEmployeeToken(refreshToken);

    return successResponse({ access_token }, 'Token refreshed successfully');
  }
}
