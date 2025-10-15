import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { PegawaiService } from './pegawai.service';
import { CreatePegawaiDto, UpdatePegawaiDto } from './dto/pegawai.dto';
import { successResponse } from 'src/utils/response.utils';

@Controller({ path: 'pegawai', version: '1' })
export class PegawaiController {
  constructor(private readonly pegawaiService: PegawaiService) {}

  @Post()
  async create(@Body() createPegawaiDto: CreatePegawaiDto) {
    return successResponse(
      await this.pegawaiService.create(createPegawaiDto),
      'Data Created',
      201,
    );
  }

  @Get()
  async findAll() {
    return successResponse(await this.pegawaiService.findAll(), 'Data found');
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return successResponse(await this.pegawaiService.findOne(id), 'Data found');
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePegawaiDto: UpdatePegawaiDto,
  ) {
    return successResponse(
      await this.pegawaiService.update(id, updatePegawaiDto),
      'Update Success',
    );
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return successResponse(
      await this.pegawaiService.remove(id),
      'Delete Success',
    );
  }
}
