import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeeService } from '../employee/employee.service';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { successResponse } from 'src/utils/response.utils';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { BankService } from '../bank/bank.service';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Controller({ path: 'company', version: '1' })
@UseGuards(CompanyAuthGuard)
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly employeeService: EmployeeService,
    private readonly bankService: BankService,
  ) {}

  @Post('employee')
  async createEmployee(
    @Req() req: Request & { user: TokenPayloadDto },
    @Body() dto: CreateEmployeeDto,
  ) {
    const company_id = req.user.sub;

    const bankExist = await this.bankService.findOne(dto.bank_id);

    if (!bankExist) {
      throw new BadRequestException('Bank not found');
    }

    const newEmployee = await this.employeeService.createEmployeeByCompany(
      company_id,
      dto,
    );

    return successResponse(newEmployee, 'Employee created successfully', 201);
  }

  @Get('employee')
  async getEmployees(@Req() req: Request & { user: TokenPayloadDto }) {
    const company_id = req.user.sub;
    const employees =
      await this.employeeService.getEmployeesByCompany(company_id);
    return successResponse(employees, 'Employees retrieved successfully');
  }

  @Get('employee/:employee_id')
  async getEmployeeById(
    @Req() req: Request & { user: TokenPayloadDto },
    @Param('employee_id') employee_id: string,
  ) {
    const company_id = req.user.sub;
    const employee = await this.employeeService.getEmployeeByIdByCompany(
      company_id,
      employee_id,
    );

    if (!employee) {
      throw new BadRequestException('Employee not found');
    }

    return successResponse(employee, 'Employee retrieved successfully');
  }

  @Patch('employee/:employee_id')
  async updateEmployee(
    @Req() req: Request & { user: TokenPayloadDto },
    @Param('employee_id') employee_id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    const company_id = req.user.sub;
    const employee = await this.employeeService.getEmployeeByIdByCompany(
      company_id,
      employee_id,
    );

    if (!employee) {
      throw new BadRequestException('Employee not found');
    }

    if (dto.bank_id) {
      const bankExist = await this.bankService.findOne(dto.bank_id);

      if (!bankExist) {
        throw new BadRequestException('Bank not found');
      }
    }

    const data = await this.employeeService.updateEmployeeByIdByCompany(
      company_id,
      employee_id,
      dto,
    );

    return successResponse(data, 'Employee updated successfully');
  }

  @Delete('employee/:employee_id')
  async deleteEmployee(
    @Req() req: Request & { user: TokenPayloadDto },
    @Param('employee_id') employee_id: string,
  ) {
    const company_id = req.user.sub;
    const employee = await this.employeeService.getEmployeeByIdByCompany(
      company_id,
      employee_id,
    );

    if (!employee) {
      throw new BadRequestException('Employee not found');
    }

    const data = await this.employeeService.deleteEmployeeByIdByCompany(
      company_id,
      employee_id,
    );

    if (!data) {
      throw new BadRequestException('Failed to delete employee');
    }

    return successResponse(data, 'Employee deleted successfully');
  }
}
