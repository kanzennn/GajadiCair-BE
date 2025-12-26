import {
  Controller,
  Post,
  UploadedFile,
  Req,
  UseInterceptors,
  UseGuards,
  UploadedFiles,
  Delete,
  Get,
} from '@nestjs/common';
import { FaceRecognitionService } from './face-recognition.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { successResponse } from 'src/utils/response.utils';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { EmployeeAuthGuard } from '../auth/guards/employee.guard';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';

@Controller({ path: 'employee/face-recognition', version: '1' })
export class FaceRecognitionController {
  constructor(
    private readonly faceRecognitionService: FaceRecognitionService,
  ) {}

  @Post('check-face')
  @UseGuards(EmployeeAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async checkFace(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No image uploaded');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = await this.faceRecognitionService.checkFace(file);

    return successResponse(data);
  }

  // 20 Image
  @Post('enroll-face')
  @UseGuards(EmployeeAuthGuard)
  @UseInterceptors(FilesInterceptor('files', 50))
  async enrollFace(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request & { user: TokenPayloadDto },
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No images uploaded');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = await this.faceRecognitionService.enrollFace(
      files,
      req.user.sub,
    );

    return successResponse(data);
  }

  @Delete('remove-face')
  @UseGuards(EmployeeAuthGuard)
  async removeFace(@Req() req: Request & { user: TokenPayloadDto }) {
    const data = await this.faceRecognitionService.deleteFaceData(req.user.sub);
    return successResponse(data);
  }

  @Get('gesture-list')
  @UseGuards(EmployeeAuthGuard)
  async getGestureList() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = await this.faceRecognitionService.getGestureList();
    return successResponse(data);
  }
}
