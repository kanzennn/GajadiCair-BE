import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { CreateEmployeeDto } from '../company/dto/create-employee.dto';
import { UpdateEmployeeDto } from '../company/dto/update-employee.dto';
import { hash } from 'argon2';
import { CustomMailerService } from 'src/common/services/mailer/mailer.service';

@Injectable()
export class EmployeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailerService: CustomMailerService,
  ) {}

  async createEmployeeByCompany(
    company_id: string,
    createEmployeeDto: CreateEmployeeDto,
  ) {
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
          companyCode: data.company_id,
          employeeCode: data.employee_id,
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
    if (updateData.password) {
      updateData.password = await hash(updateData.password);
    }

    return await this.prisma.employee.update({
      where: { company_id, employee_id, deleted_at: null },
      data: updateData,
    });
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
}
