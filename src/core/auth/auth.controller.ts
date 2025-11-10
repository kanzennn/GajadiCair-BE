import {
  Controller,
  Post,
  Body,
  Res,
  HttpCode,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginWithGoogleAuthDto } from './dto/login-with-google.dto';
import type { Response } from 'express';
import { successResponse } from 'src/utils/response.utils';
import { TokenPayloadDto } from './dto/token-payload.dto';
import { CompanyService } from '../company/company.service';
import { CompanyAuthGuard } from './guards/company.guard';
import { LoginEmployeeAuthDto } from './dto/login-employee-auth.dto';
import { EmployeeAuthGuard } from './guards/employee.guard';
import { EmployeeService } from '../employee/employee.service';

@Controller({ path: 'auth', version: '1' })
export class AuthControllerV1 {
  constructor(
    private readonly authService: AuthService,
    private readonly companyService: CompanyService,
    private readonly employeeService: EmployeeService,
  ) {}

  @Post('company/login')
  @HttpCode(200)
  async loginCompany(
    @Body() loginAuthDto: LoginAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { company, access_token, refresh_token } =
      await this.authService.loginCompany(loginAuthDto);

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

  @Post('company/login/google')
  async loginWithGoogleCompany(
    @Body() loginWithGoogleAuthDto: LoginWithGoogleAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { company, access_token, refresh_token } =
      await this.authService.googleLoginCompany(
        loginWithGoogleAuthDto.id_token,
      );

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

  @Post('company/register')
  async registerCompany(
    @Body() registerAuthDto: RegisterAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { company, access_token, refresh_token } =
      await this.authService.registerCompany(registerAuthDto);

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

  @Get('company/profile')
  @HttpCode(200)
  @UseGuards(CompanyAuthGuard)
  async getProfile(@Req() req: Request & { user: TokenPayloadDto }) {
    return successResponse(
      {
        ...(await this.companyService.getCompanyById(req.user.sub)),
        password: undefined,
      },
      'Profile fetched successfully',
    );
  }

  @Post('employee/login')
  @HttpCode(200)
  async loginEmployee(
    @Body() loginAuthDto: LoginEmployeeAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { employee, access_token, refresh_token } =
      await this.authService.loginEmployee(loginAuthDto);

    res.setHeader('Authorization', `Bearer ${access_token}`);

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      // secure: process.env.NODE_ENV === 'production',
      secure: false,
      sameSite: 'none',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 hari
    });

    return successResponse(employee, 'Login successful');
  }

  @Get('employee/profile')
  @HttpCode(200)
  @UseGuards(EmployeeAuthGuard)
  async getEmployeeProfile(@Req() req: Request & { user: TokenPayloadDto }) {
    console.log("memek");
    return successResponse(
      {
        ...(await this.employeeService.getEmployeeById(req.user.sub)),
        password: undefined,
      },
      'Profile fetched successfully',
    );
  }
}
