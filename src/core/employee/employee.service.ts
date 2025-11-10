import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { CreateEmployeeDto } from '../company/dto/create-employee.dto';
import { UpdateEmployeeDto } from '../company/dto/update-employee.dto';
import { hash } from 'argon2';

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  async createEmployeeByCompany(
    company_id: string,
    createEmployeeDto: CreateEmployeeDto,
  ) {
    createEmployeeDto.password = await hash(createEmployeeDto.password);

    return await this.prisma.employee.create({
      data: {
        ...createEmployeeDto,
        company_id,
      },
    });
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
