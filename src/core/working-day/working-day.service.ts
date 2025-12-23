import { Injectable } from '@nestjs/common';
import { UpdateWorkingDayDto } from './dto/update-working-day.dto';
import { PrismaService } from 'src/common/services/prisma/prisma.service';

@Injectable()
export class WorkingDayService {
  constructor(private readonly prisma: PrismaService) {}
  async get(companyId: string) {
    return await this.prisma.companyWorkingDay.findFirst({
      where: {
        company_id: companyId,
        deleted_at: null,
      },
      select: {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: true,
      },
    });
  }

  async update(companyId: string, updateWorkingDayDto: UpdateWorkingDayDto) {
    const workingDayExists = await this.prisma.companyWorkingDay.findFirst({
      where: {
        company_id: companyId,
        deleted_at: null,
      },
    });
    if (!workingDayExists) {
      return await this.prisma.companyWorkingDay.create({
        data: {
          company_id: companyId,
          ...updateWorkingDayDto,
        },
        select: {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: true,
          sunday: true,
        },
      });
    }

    return await this.prisma.companyWorkingDay.update({
      where: {
        company_working_day_id: workingDayExists.company_working_day_id,
      },
      data: {
        ...updateWorkingDayDto,
      },
      select: {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: true,
      },
    });
  }
}
