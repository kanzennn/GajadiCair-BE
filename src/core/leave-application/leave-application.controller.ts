import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';

import { successResponse } from 'src/utils/response.utils';
import { convertFilename } from 'src/utils/convertString.utils';

import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { S3Service } from 'src/common/services/s3/s3.service';

import { EmployeeAuthGuard } from '../auth/guards/employee.guard';
import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { TokenPayloadInterface } from '../auth/interfaces/token-payload.interface';

import { LeaveApplicationService } from './leave-application.service';
import { CreateLeaveApplicationDto } from './dto/create-leave-application.dto';
import { UpdateStatusLeaveApplicationDto } from './dto/update-status-leave-application.dto';

@Controller({ version: '1' })
export class LeaveApplicationController {
  constructor(
    private readonly leaveApplicationService: LeaveApplicationService,
    private readonly s3: S3Service,
  ) {}

  // ===================== Employee =====================

  @Get('employee/leave-application')
  @UseGuards(EmployeeAuthGuard)
  async getEmployeeLeaveApplications(
    @Req() req: Request & { user: TokenPayloadInterface },
  ) {
    const data =
      await this.leaveApplicationService.getEmployeeLeaveApplications(
        req.user.sub,
      );

    return successResponse(data, 'Leave applications fetched successfully');
  }

  @Post('employee/leave-application')
  @UseGuards(EmployeeAuthGuard)
  @UseInterceptors(FileInterceptor('attachment'))
  async createApplication(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { user: TokenPayloadInterface },
    @Body() dto: CreateLeaveApplicationDto,
  ) {
    if (!file) throw new BadRequestException('Attachment file is required');

    const key = `company/leave-application/${Date.now()}-${convertFilename(
      file.originalname,
    )}`;

    const uploaded = await this.s3.uploadBuffer({
      key,
      buffer: file.buffer,
      contentType: file.mimetype,
      cacheControl: 'public, max-age=31536000',
    });

    dto.attachment_uri = uploaded.key;

    const created = await this.leaveApplicationService.create(
      req.user.sub,
      dto,
    );

    return successResponse(created, 'Leave application created successfully');
  }

  // ===================== Company =====================

  @Get('company/leave-application')
  @UseGuards(CompanyAuthGuard)
  async getCompanyLeaveApplications(
    @Req() req: Request & { user: TokenPayloadInterface },
  ) {
    const data = await this.leaveApplicationService.getCompanyLeaveApplications(
      req.user.sub,
    );

    return successResponse(data, 'Leave applications fetched successfully');
  }

  @Put('company/leave-application/status')
  @UseGuards(CompanyAuthGuard)
  async updateCompanyLeaveApplication(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Body() dto: UpdateStatusLeaveApplicationDto,
  ) {
    const updated =
      await this.leaveApplicationService.updateLeaveApplicationStatus(
        req.user.sub,
        dto,
      );

    return successResponse(
      updated,
      'Leave application status updated successfully',
    );
  }
}
