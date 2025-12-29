import { Controller, Get, Body, UseGuards, Req, Put } from '@nestjs/common';
import { WorkingDayService } from './working-day.service';
import { UpdateWorkingDayDto } from './dto/update-working-day.dto';
import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { TokenPayloadInterface } from '../auth/interfaces/token-payload.interface';
import { successResponse } from 'src/utils/response.utils';

@Controller({ path: 'company/working-day', version: '1' })
export class WorkingDayController {
  constructor(private readonly workingDayService: WorkingDayService) {}

  @Get()
  @UseGuards(CompanyAuthGuard)
  async getWorkingDay(@Req() req: Request & { user: TokenPayloadInterface }) {
    return successResponse(
      await this.workingDayService.get(req.user.sub),
      'Working day fetched successfully',
    );
  }

  @Put()
  @UseGuards(CompanyAuthGuard)
  async updateWorkingDay(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Body() updateWorkingDayDto: UpdateWorkingDayDto,
  ) {
    return successResponse(
      await this.workingDayService.update(req.user.sub, updateWorkingDayDto),
      'Working day updated successfully',
    );
  }
}
