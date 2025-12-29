import { Injectable } from '@nestjs/common';
import { hash } from 'argon2';

import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { CustomMailerService } from 'src/common/services/mailer/mailer.service';
import { S3Service } from 'src/common/services/s3/s3.service';

import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

import { convertFilename } from 'src/utils/convertString.utils';

import { CompanyService } from '../company/company.service';

import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateProfileEmployeeDto } from './dto/update-profile-employee.dto';

import { Employee } from 'generated/prisma';

@Injectable()
export class EmployeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailerService: CustomMailerService,
    private readonly companyService: CompanyService,
    private readonly s3: S3Service,
  ) {}

  // ===================== Profile =====================

  async updateEmployeeProfile(
    employee_id: string,
    updateData: UpdateProfileEmployeeDto,
    file: Express.Multer.File,
  ) {
    const employee = await this.getEmployeeById(employee_id);
    if (!employee) throw new BadRequestException('Employee not found');

    if (file) {
      const key = `employee/profile-picture/${Date.now()}-${convertFilename(file.originalname)}`;

      const uploaded = await this.s3.uploadBuffer({
        key,
        buffer: file.buffer,
        contentType: file.mimetype,
        cacheControl: 'public, max-age=31536000',
      });

      updateData.avatar_uri = uploaded.key;
    }

    const updated = await this.prisma.employee.update({
      where: { employee_id },
      data: updateData,
    });

    return this.sanitizeEmployee(updated);
  }

  // ===================== Company Actions =====================

  async createEmployeeByCompany(
    company_id: string,
    createEmployeeDto: CreateEmployeeDto,
  ) {
    const { seat_availability } =
      await this.companyService.getAvailableSeats(company_id);

    if (seat_availability !== null && seat_availability <= 0) {
      throw new BadRequestException(
        'Seat capacity exceeded. Please upgrade your subscription plan.',
      );
    }

    const exists = await this.getEmployeeByUsernameByCompany(
      createEmployeeDto.username,
      company_id,
    );
    if (exists) throw new BadRequestException('Username already taken');

    const plainPassword = createEmployeeDto.password;
    createEmployeeDto.password = await hash(createEmployeeDto.password);

    const sendToEmail = createEmployeeDto.send_to_email;
    delete createEmployeeDto.send_to_email;

    const employee = await this.prisma.employee.create({
      data: {
        ...createEmployeeDto,
        company_id,
      },
      include: { company: true },
    });

    if (sendToEmail === true) {
      void this.mailerService.sendTemplatedEmail(
        employee.email,
        'Selamat Bergabung!',
        'send-credentials',
        {
          employeeName: employee.name,
          companyName: employee.company.name,
          companyCode: employee.company.company_identifier,
          employeeUsername: employee.username,
          password: plainPassword,
          year: new Date().getFullYear(),
          loginUrl: 'https://gajadicairbrooo.netlify.app',
          supportEmail: 'gajadicair@gmail.com',
        },
      );
    }

    return this.sanitizeEmployee(employee);
  }

  async getEmployeesByCompany(company_id: string) {
    return this.prisma.employee.findMany({
      where: { company_id, deleted_at: null },
      select: {
        employee_id: true,
        name: true,
        email: true,
        username: true,
        company_id: true,
        is_active: true,
        base_salary: true,
        is_face_enrolled: true,
        bank_id: true,
        bank_account_number: true,
        tax_identification_number: true,
        avatar_uri: true,
        last_login: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  async getCountEmployeesByCompany(company_id: string) {
    return this.prisma.employee.count({
      where: { company_id, deleted_at: null },
    });
  }

  async getEmployeeByIdByCompany(company_id: string, employee_id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { company_id, employee_id, deleted_at: null },
    });

    if (!employee) throw new BadRequestException('Employee not found');

    return this.sanitizeEmployee(employee);
  }

  async updateEmployeeByIdByCompany(
    company_id: string,
    employee_id: string,
    updateData: UpdateEmployeeDto,
  ) {
    if (updateData.username) {
      const exists = await this.getEmployeeByUsernameByCompany(
        updateData.username,
        company_id,
      );

      if (exists && exists.employee_id !== employee_id) {
        throw new BadRequestException('Username already taken');
      }
    }

    let plainPassword: string | undefined;
    if (updateData.password) {
      plainPassword = updateData.password;
      updateData.password = await hash(updateData.password);
    }

    const sendToEmail = updateData.send_to_email;
    delete updateData.send_to_email;

    const employee = await this.prisma.employee.update({
      // NOTE: kalau schema kamu tidak mendukung `deleted_at` di unique constraint,
      // jangan taruh `deleted_at` di where (biar ga error prisma).
      where: { company_id, employee_id, deleted_at: null },
      data: updateData,
      include: { company: true },
    });

    if (sendToEmail === true) {
      const companyName = employee.company.name;

      if (plainPassword !== undefined && !updateData.username) {
        void this.mailerService.sendTemplatedEmail(
          employee.email,
          'Pemberitahuan Penggantian Data Pengguna',
          'send-updated-data-user',
          {
            employeeName: employee.name,
            companyName,
            year: new Date().getFullYear(),
            loginUrl: 'https://gajadicairbrooo.netlify.app',
            supportEmail: 'gajadicair@gmail.com',
          },
        );

        return this.sanitizeEmployee(employee);
      }

      void this.mailerService.sendTemplatedEmail(
        employee.email,
        'Pemberitahuan Penggantian Kredensial',
        'send-new-credentials',
        {
          employeeName: employee.name,
          companyName,
          companyCode: employee.company.company_identifier,
          employeeUsername: employee.username,
          password: plainPassword,
          year: new Date().getFullYear(),
          loginUrl: 'https://gajadicairbrooo.netlify.app',
          supportEmail: 'gajadicair@gmail.com',
        },
      );
    }

    return this.sanitizeEmployee(employee);
  }

  async deleteEmployeeByIdByCompany(company_id: string, employee_id: string) {
    return this.prisma.employee.update({
      where: { company_id, employee_id, deleted_at: null },
      data: { deleted_at: new Date() },
    });
  }

  // ===================== Query Helpers =====================

  async getEmployeeById(employee_id: string) {
    return this.prisma.employee.findFirst({
      where: { employee_id, deleted_at: null },
    });
  }

  async getEmployeeByIdIncludeCompany(employee_id: string) {
    return this.prisma.employee.findFirst({
      where: { employee_id, deleted_at: null },
      include: { company: true },
    });
  }

  async getEmployeeByUsernameByCompany(username: string, company_id: string) {
    return this.prisma.employee.findFirst({
      where: { username, company_id, deleted_at: null },
    });
  }

  // ===================== Sanitizer =====================

  private sanitizeEmployee(employee: Employee) {
    return { ...employee, password: undefined };
  }
}
