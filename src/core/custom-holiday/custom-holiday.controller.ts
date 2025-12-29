import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { successResponse } from 'src/utils/response.utils';

import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { TokenPayloadInterface } from '../auth/interfaces/token-payload.interface';

import { CustomHolidayService } from './custom-holiday.service';
import { CreateCustomHolidayDto } from './dto/create-custom-holiday.dto';
import { UpdateCustomHolidayDto } from './dto/update-custom-holiday.dto';

@Controller({ path: 'company/custom-holiday', version: '1' })
@UseGuards(CompanyAuthGuard)
export class CustomHolidayController {
  constructor(private readonly customHolidayService: CustomHolidayService) {}

  @Post()
  async create(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Body() dto: CreateCustomHolidayDto,
  ) {
    const data = await this.customHolidayService.createByCompany(
      req.user.sub,
      dto,
    );
    return successResponse(data, 'Custom holiday created successfully', 201);
  }

  @Get()
  async findAll(@Req() req: Request & { user: TokenPayloadInterface }) {
    const data = await this.customHolidayService.findAllByCompany(req.user.sub);
    return successResponse(data, 'Custom holidays fetched successfully');
  }

  @Get(':company_custom_holiday_id')
  async findOne(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Param('company_custom_holiday_id') company_custom_holiday_id: string,
  ) {
    const data = await this.customHolidayService.findOneByIdByCompany(
      req.user.sub,
      company_custom_holiday_id,
    );

    return successResponse(data, 'Custom holiday fetched successfully');
  }

  @Put(':company_custom_holiday_id')
  async update(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Param('company_custom_holiday_id') company_custom_holiday_id: string,
    @Body() dto: UpdateCustomHolidayDto,
  ) {
    const data = await this.customHolidayService.updateByCompany(
      req.user.sub,
      company_custom_holiday_id,
      dto,
    );

    return successResponse(data, 'Custom holiday updated successfully');
  }

  @Delete(':company_custom_holiday_id')
  async remove(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Param('company_custom_holiday_id') company_custom_holiday_id: string,
  ) {
    const data = await this.customHolidayService.removeByCompany(
      req.user.sub,
      company_custom_holiday_id,
    );

    return successResponse(data, 'Custom holiday removed successfully');
  }
}
