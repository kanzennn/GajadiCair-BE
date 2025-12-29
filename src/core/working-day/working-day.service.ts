import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/common/services/prisma/prisma.service';

import { UpdateWorkingDayDto } from './dto/update-working-day.dto';

@Injectable()
export class WorkingDayService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly selectDays = {
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: true,
    sunday: true,
  } as const;

  async get(companyId: string) {
    return this.prisma.companyWorkingDay.findFirst({
      where: { company_id: companyId, deleted_at: null },
      select: this.selectDays,
    });
  }

  async update(companyId: string, dto: UpdateWorkingDayDto) {
    const existing = await this.prisma.companyWorkingDay.findFirst({
      where: { company_id: companyId, deleted_at: null },
      select: { company_working_day_id: true },
    });

    // kalau belum ada → create
    if (!existing) {
      return this.prisma.companyWorkingDay.create({
        data: { company_id: companyId, ...dto },
        select: this.selectDays,
      });
    }

    // kalau sudah ada → update by id
    return this.prisma.companyWorkingDay.update({
      where: { company_working_day_id: existing.company_working_day_id },
      data: { ...dto },
      select: this.selectDays,
    });
  }
}
