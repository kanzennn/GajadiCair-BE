import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { CreatePegawaiDto, UpdatePegawaiDto } from './dto/pegawai.dto';

@Injectable()
export class PegawaiService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreatePegawaiDto) {
    return await this.prisma.employee.create({
      data: {
        ...data,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  }

  async findAll() {
    return await this.prisma.employee.findMany({
      where: { deleted_at: null },
    });
  }

  async findOne(id: number) {
    const pegawai = await this.prisma.employee.findUnique({
      where: { id },
    });
    if (!pegawai || pegawai.deleted_at != null) {
      throw new NotFoundException(`Pegawai dengan ID ${id} tidak ditemukan`);
    }
    return pegawai;
  }

  async update(id: number, data: UpdatePegawaiDto) {
    const existing = await this.findOne(id);
    return await this.prisma.employee.update({
      where: { id: existing.id },
      data,
    });
  }

  async remove(id: number) {
    const existing = await this.findOne(id);
    return await this.prisma.employee.update({
      where: { id: existing.id },
      data: { deleted_at: new Date() },
    });
  }
}
