import {
  Controller,
  Post,
  Body,
  Res,
  HttpCode,
  Get,
  Req,
  UseGuards,
  Put,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginWithGoogleAuthDto } from './dto/login-with-google.dto';
import type { Request, Response } from 'express';
import { successResponse } from 'src/utils/response.utils';
import { TokenPayloadDto } from './dto/token-payload.dto';
import { CompanyService } from '../company/company.service';
import { CompanyAuthGuard } from './guards/company.guard';
import { LoginEmployeeAuthDto } from './dto/login-employee-auth.dto';
import { EmployeeAuthGuard } from './guards/employee.guard';
import { EmployeeService } from '../employee/employee.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { S3Service } from 'src/common/services/s3/s3.service';
import { convertFilename } from 'src/utils/convertString.utils';
import { UpdateProfileEmployeeDto } from './dto/update-profile-employee.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller({ path: 'auth', version: '1' })
export class AuthControllerV1 {
  constructor(
    private readonly authService: AuthService,
    private readonly companyService: CompanyService,
    private readonly employeeService: EmployeeService,
    private readonly s3: S3Service,
  ) {}

  @Post('company/login')
  @HttpCode(200)
  async loginCompany(
    @Body() loginAuthDto: LoginAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { company, access_token, refresh_token } =
      await this.authService.loginCompany(loginAuthDto);

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      // secure: process.env.NODE_ENV === 'production',
      secure: false,
      sameSite: 'none',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 hari
    });

    return successResponse({ company, access_token }, 'Login successful');
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

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      // secure: process.env.NODE_ENV === 'production',
      secure: false,
      sameSite: 'none',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 hari
    });

    return successResponse({ company, access_token }, 'Login successful');
  }

  @Post('company/register')
  async registerCompany(
    @Body() registerAuthDto: RegisterAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { company, access_token, refresh_token } =
      await this.authService.registerCompany(registerAuthDto);

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      // secure: process.env.NODE_ENV === 'production',
      secure: false,
      sameSite: 'none',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 hari
    });

    return successResponse({ company, access_token }, 'Login successful', 201);
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

  @Put('company/profile')
  @HttpCode(200)
  @UseGuards(CompanyAuthGuard)
  @UseInterceptors(FileInterceptor('profile_picture'))
  async updateProfile(
    @Req() req: Request & { user: TokenPayloadDto },
    @Body() dto: UpdateProfileDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (file) {
      const key = `company/profile-picture/${Date.now()}-${convertFilename(file.originalname)}`;

      const picture = await this.s3.uploadBuffer({
        key,
        buffer: file.buffer,
        contentType: file.mimetype,
        cacheControl: 'public, max-age=31536000',
      });

      dto.avatar_uri = picture.key;
    }

    console.log(dto);

    const updatedCompany = await this.companyService.updateCompanyProfile(
      req.user.sub,
      dto,
    );
    return successResponse(
      {
        ...updatedCompany,
        password: undefined,
      },
      'Profile updated successfully',
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
    const refresh_token = req.cookies['refresh_token'] as string;

    if (!refresh_token) {
      throw new BadRequestException('Refresh token not found');
    }

    const { access_token } =
      await this.authService.refreshCompanyToken(refresh_token);

    return successResponse({ access_token }, 'Token refreshed successfully');
  }

  @Post('employee/login')
  @HttpCode(200)
  async loginEmployee(
    @Body() loginAuthDto: LoginEmployeeAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { employee, access_token, refresh_token } =
      await this.authService.loginEmployee(loginAuthDto);

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      // secure: process.env.NODE_ENV === 'production',
      secure: false,
      sameSite: 'none',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 hari
    });

    return successResponse({ employee, access_token }, 'Login successful');
  }

  @Get('employee/profile')
  @HttpCode(200)
  @UseGuards(EmployeeAuthGuard)
  async getEmployeeProfile(@Req() req: Request & { user: TokenPayloadDto }) {
    return successResponse(
      {
        ...(await this.employeeService.getEmployeeById(req.user.sub)),
        password: undefined,
      },
      'Profile fetched successfully',
    );
  }

  @Put('employee/profile')
  @HttpCode(200)
  @UseGuards(EmployeeAuthGuard)
  @UseInterceptors(FileInterceptor('profile_picture'))
  async updateEmployeeProfile(
    @Req() req: Request & { user: TokenPayloadDto },
    @Body() dto: UpdateProfileEmployeeDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (file) {
      const key = `employee/profile-picture/${Date.now()}-${convertFilename(file.originalname)}`;

      const picture = await this.s3.uploadBuffer({
        key,
        buffer: file.buffer,
        contentType: file.mimetype,
        cacheControl: 'public, max-age=31536000',
      });

      dto.avatar_uri = picture.key;
    }

    const updatedEmployee = await this.employeeService.updateEmployeeProfile(
      req.user.sub,
      dto,
    );

    return successResponse(
      {
        ...updatedEmployee,
        password: undefined,
      },
      'Profile updated successfully',
    );
  }

  @Put('employee/change-password')
  @HttpCode(200)
  @UseGuards(CompanyAuthGuard)
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
    const refresh_token = req.cookies['refresh_token'] as string;

    if (!refresh_token) {
      throw new BadRequestException('Refresh token not found');
    }

    const { access_token } =
      await this.authService.refreshEmployeeToken(refresh_token);

    return successResponse({ access_token }, 'Token refreshed successfully');
  }
}
