import { Module } from '@nestjs/common';
import { PegawaiService } from './pegawai.service';
import { PegawaiController } from './pegawai.controller';
import { PrismaService } from 'src/common/services/prisma/prisma.service';

@Module({
  controllers: [PegawaiController],
  providers: [PegawaiService, PrismaService],
})
export class PegawaiModule {}
