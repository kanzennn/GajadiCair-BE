import { Controller, Post, Body, UploadedFile, Req, UseInterceptors } from '@nestjs/common';
import { FaceRecognitionService } from './face-recognition.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { successResponse } from 'src/utils/response.utils';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller({ path: 'employee/face-recognition', version: '1' })
export class FaceRecognitionController {
  constructor(
    private readonly faceRecognitionService: FaceRecognitionService,
  ) {}

  @Post('check-face')
  @UseInterceptors(FileInterceptor('file'))
  async checkFace(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    console.log(file);
    if (!file) {
      throw new BadRequestException('No image uploaded');
    }


    const data = await this.faceRecognitionService.checkFace(file);

    return successResponse(data);
  }
}
