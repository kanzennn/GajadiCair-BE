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
import { EmployeeService } from './employee.service';
import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { CompanyService } from '../company/company.service';
import { BankService } from '../bank/bank.service';
import { successResponse } from 'src/utils/response.utils';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { TokenPayloadInterface } from '../auth/interfaces/token-payload.interface';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeeAuthGuard } from '../auth/guards/employee.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateProfileEmployeeDto } from './dto/update-profile-employee.dto';

@Controller({ version: '1' })
export class EmployeeController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly employeeService: EmployeeService,
    private readonly bankService: BankService,
  ) {}

  @Get('employee/profile')
  @HttpCode(200)
  @UseGuards(EmployeeAuthGuard)
  async getEmployeeProfile(
    @Req() req: Request & { user: TokenPayloadInterface },
  ) {
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

  @Post('company/employee')
  @UseGuards(CompanyAuthGuard)
  async createEmployee(
    @Req() req: Request & { user: TokenPayloadInterface },
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

  @Get('company/employee')
  @UseGuards(CompanyAuthGuard)
  async getEmployees(@Req() req: Request & { user: TokenPayloadInterface }) {
    const company_id = req.user.sub;
    const employees =
      await this.employeeService.getEmployeesByCompany(company_id);

    const availableSeats =
      await this.companyService.getAvailableSeats(company_id);
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

    if (!employee) {
      throw new BadRequestException('Employee not found');
    }

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

  @Delete('company/employee/:employee_id')
  @UseGuards(CompanyAuthGuard)
  async deleteEmployee(
    @Req() req: Request & { user: TokenPayloadInterface },
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
