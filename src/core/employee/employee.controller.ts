import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { successResponse } from 'src/utils/response.utils';

import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

import { TokenPayloadInterface } from '../auth/interfaces/token-payload.interface';
import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { EmployeeAuthGuard } from '../auth/guards/employee.guard';

import { BankService } from '../bank/bank.service';
import { CompanyService } from '../company/company.service';
import { SubscriptionService } from '../subscription/subscription.service';

import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateProfileEmployeeDto } from './dto/update-profile-employee.dto';

import { EmployeeService } from './employee.service';

@Controller({ version: '1' })
export class EmployeeController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly employeeService: EmployeeService,
    private readonly bankService: BankService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  // ===================== Employee =====================

  @Get('employee/profile')
  @HttpCode(200)
  @UseGuards(EmployeeAuthGuard)
  async getEmployeeProfile(
    @Req() req: Request & { user: TokenPayloadInterface },
  ) {
    const employee = await this.employeeService.getEmployeeById(req.user.sub);
    if (!employee) throw new BadRequestException('Employee not found');

    // NOTE: pastikan `getSubscriptionStatus` memang butuh employee_id
    // kalau butuh company_id, ambil dulu employee include company lalu pakai company_id
    const subscription_status =
      await this.subscriptionService.getSubscriptionStatus(employee.company_id);

    return successResponse(
      {
        ...employee,
        subscription_status,
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
    @Req() req: Request & { user: TokenPayloadInterface },
    @Body() dto: UpdateProfileEmployeeDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const updatedEmployee = await this.employeeService.updateEmployeeProfile(
      req.user.sub,
      dto,
      file,
    );

    return successResponse(
      {
        ...updatedEmployee,
        password: undefined,
      },
      'Profile updated successfully',
    );
  }

  // ===================== Company -> Employees =====================

  @Post('company/employee')
  @UseGuards(CompanyAuthGuard)
  async createEmployee(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Body() dto: CreateEmployeeDto,
  ) {
    const company_id = req.user.sub;

    const bank = await this.bankService.findOne(dto.bank_id);
    if (!bank) throw new BadRequestException('Bank not found');

    const employee = await this.employeeService.createEmployeeByCompany(
      company_id,
      dto,
    );

    return successResponse(employee, 'Employee created successfully', 201);
  }

  @Get('company/employee')
  @UseGuards(CompanyAuthGuard)
  async getEmployees(@Req() req: Request & { user: TokenPayloadInterface }) {
    const company_id = req.user.sub;

    const [employees, availableSeats] = await Promise.all([
      this.employeeService.getEmployeesByCompany(company_id),
      this.companyService.getAvailableSeats(company_id),
    ]);

    return successResponse(
      { employees, availableSeats },
      'Employees retrieved successfully',
    );
  }

  @Get('company/employee/:employee_id')
  @UseGuards(CompanyAuthGuard)
  async getEmployeeById(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Param('employee_id') employee_id: string,
  ) {
    const company_id = req.user.sub;

    const employee = await this.employeeService.getEmployeeByIdByCompany(
      company_id,
      employee_id,
    );

    return successResponse(employee, 'Employee retrieved successfully');
  }

  @Patch('company/employee/:employee_id')
  @UseGuards(CompanyAuthGuard)
  async updateEmployee(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Param('employee_id') employee_id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    const company_id = req.user.sub;

    // ensure employee exists (service will throw if not found)
    await this.employeeService.getEmployeeByIdByCompany(
      company_id,
      employee_id,
    );

    if (dto.bank_id) {
      const bank = await this.bankService.findOne(dto.bank_id);
      if (!bank) throw new BadRequestException('Bank not found');
    }

    const updated = await this.employeeService.updateEmployeeByIdByCompany(
      company_id,
      employee_id,
      dto,
    );

    return successResponse(updated, 'Employee updated successfully');
  }

  @Delete('company/employee/:employee_id')
  @UseGuards(CompanyAuthGuard)
  async deleteEmployee(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Param('employee_id') employee_id: string,
  ) {
    const company_id = req.user.sub;

    // ensure employee exists (service will throw if not found)
    await this.employeeService.getEmployeeByIdByCompany(
      company_id,
      employee_id,
    );

    const deleted = await this.employeeService.deleteEmployeeByIdByCompany(
      company_id,
      employee_id,
    );

    if (!deleted) throw new BadRequestException('Failed to delete employee');

    return successResponse(deleted, 'Employee deleted successfully');
  }
}
