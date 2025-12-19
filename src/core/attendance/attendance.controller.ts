import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  Get,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { EmployeeAuthGuard } from '../auth/guards/employee.guard';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { CheckInDto } from './dto/check-in.dto';
import { successResponse } from 'src/utils/response.utils';

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
}
