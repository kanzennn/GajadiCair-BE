import {
  Controller,
  Get,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  Req,
  UseGuards,
  Put,
} from '@nestjs/common';
import { LeaveApplicationService } from './leave-application.service';
import { CreateLeaveApplicationDto } from './dto/create-leave-application.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { EmployeeAuthGuard } from '../auth/guards/employee.guard';
import { TokenPayloadInterface } from '../auth/interfaces/token-payload.interface';
import { convertFilename } from 'src/utils/convertString.utils';
import { S3Service } from 'src/common/services/s3/s3.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { successResponse } from 'src/utils/response.utils';
import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { UpdateStatusLeaveApplicationDto } from './dto/update-status-leave-application.dto';

@Controller({ version: '1' })
export class LeaveApplicationController {
  constructor(
    private readonly leaveApplicationService: LeaveApplicationService,
    private readonly s3: S3Service,
  ) {}

  @Get('employee/leave-application')
  @UseGuards(EmployeeAuthGuard)
  async getEmployeeLeaveApplications(
    @Req() req: Request & { user: TokenPayloadInterface },
  ) {
    return successResponse(
      await this.leaveApplicationService.getEmployeeLeaveApplications(
        req.user.sub,
      ),
      'Leave applications fetched successfully',
    );
  }

  @Post('employee/leave-application')
  @UseGuards(EmployeeAuthGuard)
  @UseInterceptors(FileInterceptor('attachment'))
  async createApplication(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { user: TokenPayloadInterface },
    @Body() createLeaveApplicationDto: CreateLeaveApplicationDto,
  ) {
    if (!file) {
      throw new BadRequestException('Attachment file is required');
    }
    const key = `company/leave-application/${Date.now()}-${convertFilename(file.originalname)}`;

    const picture = await this.s3.uploadBuffer({
      key,
      buffer: file.buffer,
      contentType: file.mimetype,
      cacheControl: 'public, max-age=31536000',
    });

    createLeaveApplicationDto.attachment_uri = picture.key;

    return successResponse(
      await this.leaveApplicationService.create(
        req.user.sub,
        createLeaveApplicationDto,
      ),
      'Leave application created successfully',
    );
  }

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
    const updatedData =
      await this.leaveApplicationService.updateLeaveApplicationStatus(
        req.user.sub,
        dto,
      );

    return successResponse(
      updatedData,
      'Leave application status updated successfully',
    );
  }
}
