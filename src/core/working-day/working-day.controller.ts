import { Controller, Get, Body, UseGuards, Req, Put } from '@nestjs/common';
import { WorkingDayService } from './working-day.service';
import { UpdateWorkingDayDto } from './dto/update-working-day.dto';
import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { successResponse } from 'src/utils/response.utils';

@Controller({ version: '1' })
export class WorkingDayController {
  constructor(private readonly workingDayService: WorkingDayService) {}

  @Get('company/working-day')
  @UseGuards(CompanyAuthGuard)
  async getWorkingDay(@Req() req: Request & { user: TokenPayloadDto }) {
    return successResponse(
      await this.workingDayService.get(req.user.sub),
      'Working day fetched successfully',
    );
  }

  @Put('company/working-day')
  @UseGuards(CompanyAuthGuard)
  async updateWorkingDay(
    @Req() req: Request & { user: TokenPayloadDto },
    @Body() updateWorkingDayDto: UpdateWorkingDayDto,
  ) {
    return successResponse(
      await this.workingDayService.update(req.user.sub, updateWorkingDayDto),
      'Working day updated successfully',
    );
  }
}
