import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  Get,
  Put,
  Query,
  Patch,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { EmployeeAuthGuard } from '../auth/guards/employee.guard';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { CheckInDto } from './dto/check-in.dto';
import { successResponse } from 'src/utils/response.utils';
import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { UpdateAttendanceSettingDto } from './dto/update-attendance-setting.dto';
import { AttendanceSummaryQueryDto } from './dto/attendance-summary-query.dto';
import { AttendanceByCompanyQueryDto } from './dto/attendance-by-company-query.dto';
import { UpdateAttendanceByCompanyDto } from './dto/update-attendance-by-company';
import { AttendanceSummaryByEmployeeQueryDto } from './dto/attendance-summary-by-employee-query.dto';

@Controller({ version: '1' })
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('employee/attendance/check-in-face')
  @UseGuards(EmployeeAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async checkInFace(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { user: TokenPayloadDto },
    @Body() dto: CheckInDto,
  ) {
    if (!file) {
      throw new BadRequestException('No image uploaded');
    }

    const data = await this.attendanceService.checkInFace(
      file,
      req.user.sub,
      dto,
    );

    return successResponse(data, 'Check-in successful');
  }

  @Post('employee/attendance/check-out-face')
  @UseGuards(EmployeeAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async checkOutFace(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { user: TokenPayloadDto },
    @Body() dto: CheckInDto,
  ) {
    if (!file) {
      throw new BadRequestException('No image uploaded');
    }

    const data = await this.attendanceService.checkOutFace(
      file,
      req.user.sub,
      dto,
    );

    return successResponse(data, 'Check-out successful');
  }

  @Get('employee/attendance/histories')
  @UseGuards(EmployeeAuthGuard)
  async getAttendanceHistories(
    @Req() req: Request & { user: TokenPayloadDto },
  ) {
    const data = await this.attendanceService.getAllAttendance(req.user.sub);

    return successResponse(data, 'Attendance histories retrieved successfully');
  }

  @Get('employee/attendance/today-status')
  @UseGuards(EmployeeAuthGuard)
  async getTodayAttendanceStatus(
    @Req() req: Request & { user: TokenPayloadDto },
  ) {
    const data = await this.attendanceService.getTodayAttendanceStatus(
      req.user.sub,
    );
    return successResponse(
      data,
      'Today attendance status retrieved successfully',
    );
  }

  @Get('employee/attendance/check-out-check')
  @UseGuards(EmployeeAuthGuard)
  async checkIfEmployeeCanCheckOut(
    @Req() req: Request & { user: TokenPayloadDto },
  ) {
    const data = await this.attendanceService.canEmployeeCheckOut(req.user.sub);
    return successResponse(
      data,
      'Check-out eligibility retrieved successfully',
    );
  }

  @Get('employee/attendance/check-in-check')
  @UseGuards(EmployeeAuthGuard)
  async checkIfEmployeeCanCheckIn(
    @Req() req: Request & { user: TokenPayloadDto },
  ) {
    const data = await this.attendanceService.canEmployeeCheckIn(req.user.sub);
    return successResponse(data, 'Check-in eligibility retrieved successfully');
  }

  @Get('company/attendance/setting')
  @UseGuards(CompanyAuthGuard)
  async getAttendanceSetting(@Req() req: Request & { user: TokenPayloadDto }) {
    const data = await this.attendanceService.getAttendanceSetting(
      req.user.sub,
    );
    return successResponse(data, 'Attendance setting retrieved successfully');
  }

  @Put('company/attendance/setting')
  @UseGuards(CompanyAuthGuard)
  async updateAttendanceSetting(
    @Req() req: Request & { user: TokenPayloadDto },
    @Body() dto: UpdateAttendanceSettingDto,
  ) {
    const data = await this.attendanceService.updateAttendanceSetting(
      req.user.sub,
      dto,
    );
    return successResponse(data, 'Attendance setting retrieved successfully');
  }

  @Get('/company/attendance/summary')
  @UseGuards(CompanyAuthGuard)
  async getAttendanceSumaryByCompany(
    @Req() req: Request & { user: TokenPayloadDto },
    @Query() query: AttendanceSummaryQueryDto,
  ) {
    const data = await this.attendanceService.getAttendanceSummaryByCompany(
      req.user.sub,
      query,
    );
    return successResponse(
      data,
      'Company attendance records retrieved successfully',
    );
  }

  @Get('/company/attendance')
  @UseGuards(CompanyAuthGuard)
  async getAttendanceByCompany(
    @Req() req: Request & { user: TokenPayloadDto },
    @Query() query: AttendanceByCompanyQueryDto,
  ) {
    const data = await this.attendanceService.getAttendanceByCompany(
      req.user.sub,
      query,
    );

    return successResponse(
      data,
      'Company attendance records retrieved successfully',
    );
  }

  @Patch('/company/attendance')
  @UseGuards(CompanyAuthGuard)
  async updateAttendanceByCompany(
    @Req() req: Request & { user: TokenPayloadDto },
    @Body() dto: UpdateAttendanceByCompanyDto,
  ) {
    const data = await this.attendanceService.updateAttendanceByCompany(
      req.user.sub,
      dto,
    );

    return successResponse(
      data,
      'Company attendance record updated successfully',
    );
  }

  @Get('/employee/attendance/summary')
  @UseGuards(EmployeeAuthGuard)
  async getAttendanceSummaryByEmployee(
    @Req() req: Request & { user: TokenPayloadDto },
    @Query() query: AttendanceSummaryByEmployeeQueryDto,
  ) {
    const data = await this.attendanceService.getAttendanceSummaryByEmployee(
      req.user.sub,
      query,
    );
    return successResponse(
      data,
      'Employee attendance summary retrieved successfully',
    );
  }
}
