import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from 'argon2';

import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { GoogleOauthService } from 'src/common/services/google/google-oauth.service';
import { S3Service } from 'src/common/services/s3/s3.service';

import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

import { LoginAuthDto } from './dto/login-auth.dto';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginEmployeeAuthDto } from './dto/login-employee-auth.dto';
import { TokenPayloadDto } from './dto/token-payload.dto';

import { CompanyService } from '../company/company.service';
import { EmployeeService } from '../employee/employee.service';
import { Company, Employee } from 'generated/prisma';

type Role = 'company' | 'employee';
type TokenType = 'access' | 'refresh';

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

  // ===================== Public APIs =====================

  async loginCompany(credentials: LoginAuthDto) {
    const company = await this.prisma.company.findFirst({
      where: { email: credentials.email },
    });

    if (!company?.password)
      throw new BadRequestException('Invalid credentials');

    const ok = await verify(company.password, credentials.password);
    if (!ok) throw new BadRequestException('Invalid credentials');

    await this.updateCompanyLastLogin(company.company_id);

    const tokens = await this.signTokens({
      sub: company.company_id,
      email: company.email,
      role: 'company',
    });

    return {
      company: this.sanitizeCompany(company),
      ...tokens,
    };
  }

  async registerCompany(dto: RegisterAuthDto) {
    const existing = await this.prisma.company.findFirst({
      where: { email: dto.email },
    });
    if (existing) throw new BadRequestException('Email already in use');

    const hashedPassword = await hash(dto.password);
    const company_identifier = await this.generateUniqueCompanyIdentifier();

    const company = await this.prisma.company.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        company_identifier,
        last_login: new Date(),
      },
    });

    await this.ensureDefaultWorkingDay(company.company_id);

    const tokens = await this.signTokens({
      sub: company.company_id,
      email: company.email,
      role: 'company',
    });

    return {
      company: this.sanitizeCompany(company),
      ...tokens,
    };
  }

  async googleLoginCompany(idToken: string) {
    const payload = await this.googleOauthService.verifyToken(idToken);
    const { sub: googleId, email, name, picture } = payload;

    if (!email) throw new BadRequestException('Google account has no email');

    // 1) Cari socialite record
    let socialite = await this.prisma.companySocialite.findFirst({
      where: { socialite_id: googleId, socialite_name: 'google' },
      include: { company: true },
    });

    // 2) Kalau belum ada, pastikan company ada (create jika belum)
    if (!socialite) {
      let company = await this.prisma.company.findFirst({ where: { email } });

      if (!company) {
        const company_identifier = await this.generateUniqueCompanyIdentifier();

        company = await this.prisma.company.create({
          data: {
            email,
            name: name ?? 'No Name',
            avatar_uri: null,
            company_identifier,
          },
        });

        await this.ensureDefaultWorkingDay(company.company_id);

        // upload avatar google -> S3 (opsional)
        if (picture) {
          const { buffer, contentType } =
            await this.downloadImageToBuffer(picture);

          const uploaded = await this.s3Service.uploadBuffer({
            key: `company/profile-picture/${Date.now()}-${company.company_id}`,
            buffer,
            contentType,
            cacheControl: 'public, max-age=31536000',
          });

          company = await this.prisma.company.update({
            where: { company_id: company.company_id },
            data: { avatar_uri: uploaded.url },
          });
        }
      }

      socialite = await this.prisma.companySocialite.create({
        data: {
          company_id: company.company_id,
          socialite_id: googleId,
          socialite_name: 'google',
        },
        include: { company: true },
      });
    }

    const company = socialite.company;
    if (!company) throw new BadRequestException('Company not found');

    await this.updateCompanyLastLogin(company.company_id);

    const tokens = await this.signTokens({
      sub: company.company_id,
      email: company.email,
      role: 'company',
    });

    return {
      company: this.sanitizeCompany(company),
      ...tokens,
    };
  }

  async changeCompanyPassword(
    company_id: string,
    old_password: string,
    new_password: string,
  ) {
    const company = await this.companyService.getCompanyById(company_id);
    if (!company) throw new BadRequestException('Company not found');

    if (!company.password) {
      throw new BadRequestException(
        'You cant change password for social login',
      );
    }

    const ok = await verify(company.password, old_password);
    if (!ok) throw new BadRequestException('Old password is incorrect');

    const hashed = await hash(new_password);

    await this.prisma.company.update({
      where: { company_id },
      data: { password: hashed },
    });

    return { success: true };
  }

  async refreshCompanyToken(refresh_token: string) {
    const payload = await this.verifyRefreshToken(refresh_token, 'company');
    const access_token = await this.signAccessToken(payload);
    return { access_token };
  }

  async loginEmployee(credentials: LoginEmployeeAuthDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { username: credentials.username },
      include: { company: true },
    });

    if (
      !employee?.password ||
      !employee.company ||
      employee.company.company_identifier !== credentials.company_identifier ||
      employee.is_active === false
    ) {
      throw new BadRequestException('Invalid credentials');
    }

    const ok = await verify(employee.password, credentials.password);
    if (!ok) throw new BadRequestException('Invalid credentials');

    await this.updateEmployeeLastLogin(employee.employee_id);

    const tokens = await this.signTokens({
      sub: employee.employee_id,
      email: employee.email,
      role: 'employee',
    });

    return {
      employee: this.sanitizeEmployee(employee),
      ...tokens,
    };
  }

  async changeEmployeePassword(
    employee_id: string,
    old_password: string,
    new_password: string,
  ) {
    const employee = await this.employeeService.getEmployeeById(employee_id);
    if (!employee) throw new BadRequestException('Employee not found');

    if (!employee.password) {
      // jaga-jaga kalau suatu saat employee juga bisa social login
      throw new BadRequestException(
        'You cant change password for social login',
      );
    }

    const ok = await verify(employee.password, old_password);
    if (!ok) throw new BadRequestException('Old password is incorrect');

    const hashed = await hash(new_password);

    await this.prisma.employee.update({
      where: { employee_id },
      data: { password: hashed },
    });

    return { success: true };
  }

  async refreshEmployeeToken(refresh_token: string) {
    const payload = await this.verifyRefreshToken(refresh_token, 'employee');
    const access_token = await this.signAccessToken(payload);
    return { access_token };
  }

  // ===================== Token helpers =====================

  private async signTokens(payload: {
    sub: string;
    email: string;
    role: Role;
  }) {
    const access_token = await this.jwtService.signAsync({
      ...payload,
      type: 'access' satisfies TokenType,
    });

    const refresh_token = await this.jwtService.signAsync(
      { ...payload, type: 'refresh' satisfies TokenType },
      { expiresIn: '7d' },
    );

    return { access_token, refresh_token };
  }

  private async signAccessToken(payload: TokenPayloadDto) {
    return this.jwtService.signAsync({
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      type: 'access' satisfies TokenType,
    });
  }

  private async verifyRefreshToken(token: string, expectedRole: Role) {
    // Kalau JwtModule kamu sudah register secret global, ini cukup:
    const payload: TokenPayloadDto = await this.jwtService.verifyAsync(token);

    // Kalau kamu memang butuh manual secret:
    // const payload = (await this.jwtService.verifyAsync(token, { secret: process.env.JWT_SECRET })) as TokenPayloadDto;

    if (payload.role !== expectedRole)
      throw new BadRequestException('Invalid refresh token');
    if (payload.type !== 'refresh')
      throw new BadRequestException('Invalid refresh token');

    return payload;
  }

  // ===================== DB helpers =====================

  private async updateCompanyLastLogin(companyId: string) {
    await this.prisma.company.update({
      where: { company_id: companyId },
      data: { last_login: new Date() },
    });
  }

  private async updateEmployeeLastLogin(employeeId: string) {
    await this.prisma.employee.update({
      where: { employee_id: employeeId },
      data: { last_login: new Date() },
    });
  }

  private async ensureDefaultWorkingDay(companyId: string) {
    // kalau sudah ada, skip (lebih aman)
    const existing = await this.prisma.companyWorkingDay.findFirst({
      where: { company_id: companyId },
    });
    if (existing) return;

    await this.prisma.companyWorkingDay.create({
      data: {
        company_id: companyId,
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
      },
    });
  }

  private sanitizeCompany(company: Company) {
    return { ...company, password: undefined };
  }

  private sanitizeEmployee(employee: Employee) {
    return { ...employee, password: undefined };
  }

  // ===================== Google avatar helper =====================

  private async downloadImageToBuffer(url: string) {
    const res = await fetch(url, {
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

  // ===================== Identifier generator =====================

  private async generateUniqueCompanyIdentifier(): Promise<string> {
    let company_identifier = this.generateRandomCode();

    while (
      await this.prisma.company.findFirst({
        where: { company_identifier },
      })
    ) {
      company_identifier = this.generateRandomCode();
    }

    return company_identifier;
  }

  private generateRandomCode(): string {
    // Payload: xxxx-xxx-xxx
    const segments = [4, 3, 3];
    const characters = '12345567890';
    let code = '';

    for (let i = 0; i < segments.length; i++) {
      for (let j = 0; j < segments[i]; j++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        code += characters[randomIndex];
      }
      if (i < segments.length - 1) code += '-';
    }

    return code;
  }
}
