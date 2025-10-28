import { Injectable } from '@nestjs/common';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';
import { PrismaService } from 'src/common/services/prisma/prisma.service';

@Injectable()
export class BankService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createBankDto: CreateBankDto) {
    return await this.prisma.bank.create({
      data: createBankDto,
    });
  }

  async findAll() {
    return await this.prisma.bank.findMany({
      where: { deleted_at: null },
    });
  }

  async findOne(bank_id: string) {
    return await this.prisma.bank.findUnique({
      where: { bank_id, deleted_at: null },
    });
  }

  async update(bank_id: string, updateBankDto: UpdateBankDto) {
    return await this.prisma.bank.update({
      where: { bank_id, deleted_at: null },
      data: updateBankDto,
    });
  }

  async remove(bank_id: string) {
    return await this.prisma.bank.update({
      where: { bank_id },
      data: { deleted_at: new Date() },
    });
  }
}
