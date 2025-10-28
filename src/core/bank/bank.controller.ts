import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { BankService } from './bank.service';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';
import { successResponse } from 'src/utils/response.utils';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

@Controller({ path: 'bank', version: '1' })
export class BankController {
  constructor(private readonly bankService: BankService) {}

  @Post()
  async create(@Body() createBankDto: CreateBankDto) {
    const data = await this.bankService.create(createBankDto);
    return successResponse(data, 'Bank created successfully', 201);
  }

  @Get()
  async findAll() {
    const data = await this.bankService.findAll();
    return successResponse(data, 'Banks retrieved successfully');
  }

  @Get(':bank_id')
  async findOne(@Param('bank_id') bank_id: string) {
    const data = await this.bankService.findOne(bank_id);
    if (!data) {
      throw new BadRequestException('Bank not found');
    }
    return successResponse(data, 'Bank retrieved successfully');
  }

  @Patch(':bank_id')
  async update(
    @Param('bank_id') bank_id: string,
    @Body() updateBankDto: UpdateBankDto,
  ) {
    const dataExists = await this.bankService.findOne(bank_id);
    if (!dataExists) {
      throw new BadRequestException('Bank not found');
    }
    const data = await this.bankService.update(bank_id, updateBankDto);
    return successResponse(data, 'Bank updated successfully');
  }

  @Delete(':bank_id')
  async remove(@Param('bank_id') bank_id: string) {
    const dataExists = await this.bankService.findOne(bank_id);
    if (!dataExists) {
      throw new BadRequestException('Bank not found');
    }
    const data = await this.bankService.remove(bank_id);
    return successResponse(data, 'Bank removed successfully');
  }
}
