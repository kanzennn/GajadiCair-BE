import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';

@Injectable()
export class BankService {
  constructor(private readonly prisma: PrismaService) {}

  // ===================== CREATE =====================

  async create(dto: CreateBankDto) {
    return this.prisma.bank.create({
      data: dto,
    });
  }

  // ===================== READ =====================

  async findAll() {
    return this.prisma.bank.findMany({
      where: { deleted_at: null },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(bank_id: string) {
    return this.prisma.bank.findFirst({
      where: { bank_id, deleted_at: null },
    });
  }

  /**
   * Helper: dipakai kalau kamu butuh "wajib ada",
   * biar controller/service lain gak nulis if (!bank) throw ... terus2an.
   */
  async mustFindOne(bank_id: string) {
    const bank = await this.findOne(bank_id);
    if (!bank) throw new BadRequestException('Bank not found');
    return bank;
  }

  // ===================== UPDATE =====================

  async update(bank_id: string, dto: UpdateBankDto) {
    // optional: pastikan bank ada & belum terhapus
    await this.mustFindOne(bank_id);

    return this.prisma.bank.update({
      where: { bank_id },
      data: dto,
    });
  }

  // ===================== DELETE (SOFT) =====================

  async remove(bank_id: string) {
    // optional: pastikan bank ada & belum terhapus
    await this.mustFindOne(bank_id);

    return this.prisma.bank.update({
      where: { bank_id },
      data: { deleted_at: new Date() },
    });
  }
}
