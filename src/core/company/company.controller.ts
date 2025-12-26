import {
  Body,
  Controller,
  Get,
  HttpCode,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { CompanyService } from './company.service';
import { TokenPayloadInterface } from '../auth/interfaces/token-payload.interface';
import { successResponse } from 'src/utils/response.utils';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller({ version: '1' })
@UseGuards(CompanyAuthGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get('company/profile')
  @HttpCode(200)
  @UseGuards(CompanyAuthGuard)
  async getProfile(@Req() req: Request & { user: TokenPayloadInterface }) {
    return successResponse(
      {
        ...(await this.companyService.getCompanyById(req.user.sub)),
        password: undefined,
      },
      'Profile fetched successfully',
    );
  }

  @Put('company/profile')
  @HttpCode(200)
  @UseGuards(CompanyAuthGuard)
  @UseInterceptors(FileInterceptor('profile_picture'))
  async updateProfile(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Body() dto: UpdateProfileDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const updatedCompany = await this.companyService.updateCompanyProfile(
      req.user.sub,
      dto,
      file,
    );
    return successResponse(
      {
        ...updatedCompany,
        password: undefined,
      },
      'Profile updated successfully',
    );
  }
}
