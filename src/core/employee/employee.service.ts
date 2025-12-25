import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { CreateEmployeeDto } from '../company/dto/create-employee.dto';
import { UpdateEmployeeDto } from '../company/dto/update-employee.dto';
import { hash } from 'argon2';
import { CustomMailerService } from 'src/common/services/mailer/mailer.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { UpdateProfileEmployeeDto } from '../auth/dto/update-profile-employee.dto';

@Injectable()
export class EmployeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailerService: CustomMailerService,
  ) {}

  async updateEmployeeProfile(
    employee_id: string,
    updateData: UpdateProfileEmployeeDto,
  ) {
    const checkIsEmployeeExist = await this.getEmployeeById(employee_id);
    if (!checkIsEmployeeExist) {
      throw new BadRequestException('Employee not found');
    }

    const updatedData = await this.prisma.employee.update({
      where: { employee_id },
      data: updateData,
    });

    return updatedData;
  }

  async createEmployeeByCompany(
    company_id: string,
    createEmployeeDto: CreateEmployeeDto,
  ) {
    const isUsernameExist = await this.getEmployeeByUsernameByCompany(
      createEmployeeDto.username,
      company_id,
    );

    if (isUsernameExist) {
      throw new BadRequestException('Username already taken');
    }

    const plainPassword = createEmployeeDto.password;
    createEmployeeDto.password = await hash(createEmployeeDto.password);
    const sendToEmail = createEmployeeDto.send_to_email;

    delete createEmployeeDto.send_to_email;

    const data = await this.prisma.employee.create({
      data: {
        ...createEmployeeDto,
        company_id,
      },
      include: {
        company: true,
      },
    });

    if (sendToEmail === true) {
      void this.mailerService.sendTemplatedEmail(
        data.email,
        'Selamat Bergabung!',
        'send-credentials',
        {
          employeeName: data.name,
          companyName: data.company.name,
          companyCode: data.company.company_identifier,
          employeeUsername: data.username,
          password: plainPassword,
          year: new Date().getFullYear(),
          loginUrl: 'https://gajadicairbrooo.netlify.app',
          supportEmail: 'gajadicair@gmail.com',
        },
      );
    }

    return data;
  }

  async getEmployeesByCompany(company_id: string) {
    return await this.prisma.employee.findMany({
      where: { company_id, deleted_at: null },
    });
  }

  async getEmployeeByIdByCompany(company_id: string, employee_id: string) {
    return await this.prisma.employee.findFirst({
      where: { company_id, employee_id, deleted_at: null },
    });
  }

  async updateEmployeeByIdByCompany(
    company_id: string,
    employee_id: string,
    updateData: UpdateEmployeeDto,
  ) {
    if (updateData.username) {
      const isUsernameExist = await this.getEmployeeByUsernameByCompany(
        updateData.username,
        company_id,
      );

      if (isUsernameExist && isUsernameExist.employee_id !== employee_id) {
        throw new BadRequestException('Username already taken');
      }
    }

    let plainPassword: string | undefined = undefined;
    if (updateData.password) {
      plainPassword = updateData.password;
      updateData.password = await hash(updateData.password);
    }

    const sendToEmail = updateData.send_to_email;

    delete updateData.send_to_email;

    const data = await this.prisma.employee.update({
      where: { company_id, employee_id, deleted_at: null },
      data: updateData,
      include: {
        company: true,
      },
    });

    if (sendToEmail === true) {
      if (plainPassword !== undefined && !updateData.username) {
        void this.mailerService.sendTemplatedEmail(
          data.email,
          'Pemberitahuan Penggantian Data Pengguna',
          'send-updated-data-user',
          {
            employeeName: data.name,
            companyName: data.company.name,
            year: new Date().getFullYear(),
            loginUrl: 'https://gajadicairbrooo.netlify.app',
            supportEmail: 'gajadicair@gmail.com',
          },
        );
      } else {
        void this.mailerService.sendTemplatedEmail(
          data.email,
          'Pemberitahuan Penggantian Kredensial',
          'send-new-credentials',
          {
            employeeName: data.name,
            companyName: data.company.name,
            companyCode: data.company.company_identifier,
            employeeUsername: data.username,
            password: plainPassword,
            year: new Date().getFullYear(),
            loginUrl: 'https://gajadicairbrooo.netlify.app',
            supportEmail: 'gajadicair@gmail.com',
          },
        );
      }
    }

    return data;
  }

  async deleteEmployeeByIdByCompany(company_id: string, employee_id: string) {
    return await this.prisma.employee.update({
      where: { company_id, employee_id, deleted_at: null },
      data: { deleted_at: new Date() },
    });
  }

  async getEmployeeById(employee_id: string) {
    return await this.prisma.employee.findFirst({
      where: { employee_id, deleted_at: null },
    });
  }

  async getEmployeeByIdIncludeCompany(employee_id: string) {
    return await this.prisma.employee.findFirst({
      where: { employee_id, deleted_at: null },
      include: { company: true },
    });
  }

  async getEmployeeByUsernameByCompany(username: string, company_id: string) {
    return await this.prisma.employee.findFirst({
      where: { username, company_id, deleted_at: null },
    });
  }
}
