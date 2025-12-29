import {
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';

import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';

import { FaceRecognitionService } from './face-recognition.service';

import { EmployeeAuthGuard } from '../auth/guards/employee.guard';
import { TokenPayloadInterface } from '../auth/interfaces/token-payload.interface';

import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { successResponse } from 'src/utils/response.utils';

@Controller({ path: 'employee/face-recognition', version: '1' })
@UseGuards(EmployeeAuthGuard)
export class FaceRecognitionController {
  constructor(
    private readonly faceRecognitionService: FaceRecognitionService,
  ) {}

  @Post('check-face')
  @UseInterceptors(FileInterceptor('file'))
  async checkFace(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No image uploaded');

    const data = await this.faceRecognitionService.checkFace(file);
    return successResponse(data);
  }

  @Post('enroll-face')
  @UseInterceptors(FilesInterceptor('files', 50))
  async enrollFace(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Req() req: Request & { user: TokenPayloadInterface },
  ) {
    if (!files?.length) throw new BadRequestException('No images uploaded');

    const data = await this.faceRecognitionService.enrollFace(
      files,
      req.user.sub,
    );
    return successResponse(data);
  }

  @Delete('remove-face')
  async removeFace(@Req() req: Request & { user: TokenPayloadInterface }) {
    const data = await this.faceRecognitionService.deleteFaceData(req.user.sub);
    return successResponse(data);
  }

  @Get('gesture-list')
  async getGestureList() {
    const data = await this.faceRecognitionService.getGestureList();
    return successResponse(data);
  }
}
