import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
  Put,
} from '@nestjs/common';
import { CustomHolidayService } from './custom-holiday.service';
import { CreateCustomHolidayDto } from './dto/create-custom-holiday.dto';
import { UpdateCustomHolidayDto } from './dto/update-custom-holiday.dto';
import { CompanyAuthGuard } from '../auth/guards/company.guard';
import { TokenPayloadInterface } from '../auth/interfaces/token-payload.interface';
import { successResponse } from 'src/utils/response.utils';

@Controller({ path: 'company/custom-holiday', version: '1' })
@UseGuards(CompanyAuthGuard)
export class CustomHolidayController {
  constructor(private readonly customHolidayService: CustomHolidayService) {}

  @Post()
  async create(
    @Req() req: Request & { user: TokenPayloadInterface },
    @Body() createCustomHolidayDto: CreateCustomHolidayDto,
  ) {
    const data = await this.customHolidayService.createByCompany(
      req.user.sub,
      createCustomHolidayDto,
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
    @Param('company_custom_holiday_id') company_custom_holiday_id: string,
    @Req() req: Request & { user: TokenPayloadInterface },
  ) {
    const data = await this.customHolidayService.findOneByIdByCompany(
      req.user.sub,
      company_custom_holiday_id,
    );

    return successResponse(data, 'Custom holiday fetched successfully');
  }

  @Put(':company_custom_holiday_id')
  async update(
    @Param('company_custom_holiday_id') company_custom_holiday_id: string,
    @Body() updateCustomHolidayDto: UpdateCustomHolidayDto,
    @Req() req: Request & { user: TokenPayloadInterface },
  ) {
    const updatedData = await this.customHolidayService.updateByCompany(
      req.user.sub,
      company_custom_holiday_id,
      updateCustomHolidayDto,
    );

    return successResponse(updatedData, 'Custom holiday updated successfully');
  }

  @Delete(':company_custom_holiday_id')
  async remove(
    @Param('company_custom_holiday_id') company_custom_holiday_id: string,
    @Req() req: Request & { user: TokenPayloadInterface },
  ) {
    const deletedData = await this.customHolidayService.removeByCompany(
      req.user.sub,
      company_custom_holiday_id,
    );

    return successResponse(deletedData, 'Custom holiday removed successfully');
  }
}
