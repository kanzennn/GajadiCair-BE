import { Injectable } from '@nestjs/common';
import { LoginAuthDto } from './dto/login-auth.dto';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { hash, verify } from 'argon2';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { GoogleOauthService } from 'src/common/services/google/google-oauth.service';
import { JwtService } from '@nestjs/jwt';
import { LoginEmployeeAuthDto } from './dto/login-employee-auth.dto';
import { TokenPayloadDto } from './dto/token-payload.dto';
import { CompanyService } from '../company/company.service';
import { EmployeeService } from '../employee/employee.service';
import { S3Service } from 'src/common/services/s3/s3.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleOauthService: GoogleOauthService,
    private readonly jwtService: JwtService,
    private readonly companyService: CompanyService,
    private readonly employeeService: EmployeeService,
    private readonly s3Service: S3Service,
  ) {}

  async loginCompany(credentials: LoginAuthDto) {
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

    const payload = {
      sub: company.company_id,
      email: company.email,
      role: 'company',
    };

    const access_token = await this.jwtService.signAsync({
      ...payload,
      type: 'access',
    });

    const refresh_token = await this.jwtService.signAsync(
      { ...payload, type: 'refresh' },
      {
        expiresIn: '7d',
      },
    );

    return {
      company: { ...company, password: undefined },
      access_token,
      refresh_token,
    };
  }

  async changeCompanyPassword(
    company_id: string,
    old_password: string,
    new_password: string,
  ) {
    const checkIsCompanyExist =
      await this.companyService.getCompanyById(company_id);

    if (!checkIsCompanyExist) {
      throw new BadRequestException('Company not found');
    }

    if (!checkIsCompanyExist.password) {
      throw new BadRequestException(
        'You cant change password for social login',
      );
    }

    const isOldPasswordValid = await verify(
      checkIsCompanyExist.password,
      old_password,
    );

    if (!isOldPasswordValid) {
      throw new BadRequestException('Old password is incorrect');
    }

    const hashedNewPassword = await hash(new_password);

    return await this.prisma.company.update({
      where: { company_id },
      data: { password: hashedNewPassword },
    });
  }

  async googleLoginCompany(idToken: string) {
    const payload = await this.googleOauthService.verifyToken(idToken);

    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      throw new BadRequestException('Google account has no email');
    }

    let socialiteRecord = await this.prisma.companySocialite.findFirst({
      where: { socialite_id: googleId, socialite_name: 'google' },
      include: { company: true },
    });

    if (!socialiteRecord) {
      let company = await this.prisma.company.findFirst({
        where: { email },
      });

      if (!company) {
        let company_identifier: string = this.generateRandomCode();

        // Ensure company_identifier is unique
        while (
          await this.prisma.company.findFirst({
            where: { company_identifier },
          })
        ) {
          company_identifier = this.generateRandomCode();
        }

        company = await this.prisma.company.create({
          data: {
            email,
            name: name ?? 'No Name',
            avatar_uri: null, // sementara
            company_identifier,
          },
        });

        await this.prisma.companyWorkingDay.create({
          data: {
            company_id: company.company_id,
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: false,
            sunday: false,
          },
        });

        // upload picture google -> bucket kamu
        if (picture) {
          const { buffer, contentType } =
            await this.downloadImageToBuffer(picture);

          const uploaded = await this.s3Service.uploadBuffer({
            key: `company/profile-picture/${Date.now()}-${company.company_id}`,
            buffer,
            contentType,
            cacheControl: 'public, max-age=31536000',
          });

          // simpan url/key hasil upload
          company = await this.prisma.company.update({
            where: { company_id: company.company_id },
            data: { avatar_uri: uploaded.url }, // atau uploaded.key kalau kamu simpan key saja
          });
        }
      }

      socialiteRecord = await this.prisma.companySocialite.create({
        data: {
          company_id: company.company_id,
          socialite_id: googleId,
          socialite_name: 'google',
        },
        include: { company: true },
      });
    }

    const company = socialiteRecord?.company;

    await this.prisma.company.update({
      where: { company_id: company?.company_id },
      data: { last_login: new Date() },
    });

    const payloadJwt = {
      sub: company?.company_id,
      email: company?.email,
      role: 'company',
    };

    const access_token = await this.jwtService.signAsync({
      ...payloadJwt,
      type: 'access',
    });

    const refresh_token = await this.jwtService.signAsync(
      { ...payloadJwt, type: 'refresh' },
      {
        expiresIn: '7d',
      },
    );

    return {
      company: { ...company, password: undefined },
      access_token,
      refresh_token,
    };
  }

  private async downloadImageToBuffer(url: string) {
    const res = await fetch(url, {
      // kadang Google butuh header user-agent
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!res.ok) {
      throw new BadRequestException(
        `Failed to download google picture: ${res.status}`,
      );
    }

    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const arrayBuffer = await res.arrayBuffer();

    return {
      buffer: Buffer.from(arrayBuffer),
      contentType,
    };
  }

  async registerCompany(registerAuthDto: RegisterAuthDto) {
    const existingcompany = await this.prisma.company.findFirst({
      where: { email: registerAuthDto.email },
    });

    if (existingcompany) throw new BadRequestException('Email already in use');

    const hashedPassword = await hash(registerAuthDto.password);

    let company_identifier: string = this.generateRandomCode();

    // Ensure company_identifier is unique
    while (
      await this.prisma.company.findFirst({
        where: { company_identifier },
      })
    ) {
      company_identifier = this.generateRandomCode();
    }

    const company = await this.prisma.company.create({
      data: {
        email: registerAuthDto.email,
        name: registerAuthDto.name,
        password: hashedPassword,
        company_identifier,
        last_login: new Date(),
      },
    });

    await this.prisma.companyWorkingDay.create({
      data: {
        company_id: company.company_id,
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
      },
    });

    const payload = {
      sub: company.company_id,
      email: company.email,
      role: 'company',
    };

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

  async refreshCompanyToken(refresh_token: string) {
    const payload: TokenPayloadDto = await this.jwtService.verify(
      refresh_token,
      {
        secret: process.env.JWT_SECRET,
      },
    );

    if (payload.role !== 'company') {
      throw new BadRequestException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new BadRequestException('Invalid refresh token');
    }

    const access_token = await this.jwtService.signAsync({
      sub: payload.sub,
      email: payload.email,
      role: 'company',
      type: 'access',
    });
    return { access_token };
  }

  async loginEmployee(credentials: LoginEmployeeAuthDto) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        username: credentials.username,
      },
      include: { company: true },
    });

    if (
      !employee ||
      !employee?.password ||
      !employee.company ||
      employee.company.company_identifier !== credentials.company_identifier ||
      employee.is_active === false
    ) {
      throw new BadRequestException('Invalid credentials');
    }

    const isPasswordValid = await verify(
      employee.password,
      credentials.password,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid credentials');
    }

    await this.prisma.employee.update({
      where: { employee_id: employee.employee_id },
      data: { last_login: new Date() },
    });

    const payload = {
      sub: employee.employee_id,
      email: employee.email,
      role: 'employee',
    };

    const access_token = await this.jwtService.signAsync({
      ...payload,
      type: 'access',
    });

    const refresh_token = await this.jwtService.signAsync(
      {
        ...payload,
        type: 'refresh',
      },
      {
        expiresIn: '7d',
      },
    );

    return {
      employee: { ...employee, password: undefined },
      access_token,
      refresh_token,
    };
  }

  async changeEmployeePassword(
    employee_id: string,
    old_password: string,
    new_password: string,
  ) {
    const checkIsEmployeeExists =
      await this.employeeService.getEmployeeById(employee_id);

    if (!checkIsEmployeeExists) {
      throw new BadRequestException('Employee not found');
    }

    const isOldPasswordValid = await verify(
      checkIsEmployeeExists.password,
      old_password,
    );

    if (!isOldPasswordValid) {
      throw new BadRequestException('Old password is incorrect');
    }

    const hashedNewPassword = await hash(new_password);

    return await this.prisma.employee.update({
      where: { employee_id },
      data: { password: hashedNewPassword },
    });
  }

  async refreshEmployeeToken(refresh_token: string) {
    const payload: TokenPayloadDto = await this.jwtService.verify(
      refresh_token,
      {
        secret: process.env.JWT_SECRET,
      },
    );

    if (payload.role !== 'employee') {
      throw new BadRequestException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new BadRequestException('Invalid refresh token');
    }

    const access_token = await this.jwtService.signAsync({
      sub: payload.sub,
      email: payload.email,
      role: 'employee',
      type: 'access',
    });
    return { access_token };
  }

  private generateRandomCode(): string {
    /// Payload: xxxx-xxx-xxx
    const segments = [4, 3, 3];
    const characters = '12345567890';
    let code = '';

    for (let i = 0; i < segments.length; i++) {
      for (let j = 0; j < segments[i]; j++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        code += characters[randomIndex];
      }
      if (i < segments.length - 1) {
        code += '-';
      }
    }
    return code;
  }
}
