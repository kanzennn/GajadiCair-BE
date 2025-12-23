import { Injectable } from '@nestjs/common';
import { CreateCustomHolidayDto } from './dto/create-custom-holiday.dto';
import { UpdateCustomHolidayDto } from './dto/update-custom-holiday.dto';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { CompanyService } from '../company/company.service';

@Injectable()
export class CustomHolidayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyService: CompanyService,
  ) {}

  // -------------------------
  // Helpers
  // -------------------------

  private async assertCompanyExists(companyId: string) {
    const company = await this.companyService.getCompanyById(companyId);
    if (!company) throw new BadRequestException('Company not found');
    return company;
  }

  private parseIsoDateToUtc(dateStr: string, fieldName: string) {
    const d = new Date(`${dateStr}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }
    return d;
  }

  private toUtcDateOnly(d: Date) {
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
  }

  private todayUtcDateOnly() {
    return this.toUtcDateOnly(new Date());
  }

  private validateRangeAndNotPast(start: Date, end: Date, todayUtc: Date) {
    if (start > end) {
      throw new BadRequestException(
        'Start date cannot be greater than end date',
      );
    }
    if (start < todayUtc || end < todayUtc) {
      throw new BadRequestException(
        'Start date and end date cannot be in the past',
      );
    }
  }

  private assertNotStartedYet(
    existingStartDate: Date,
    todayUtc: Date,
    action: 'update' | 'delete',
  ) {
    const existingStartUtc = this.toUtcDateOnly(existingStartDate);
    if (existingStartUtc <= todayUtc) {
      throw new BadRequestException(
        `Cannot ${action} custom holiday when start_date is today or in the past`,
      );
    }
  }

  private async findExistingByCompanyOrThrow(
    companyId: string,
    holidayId: string,
  ) {
    const existing = await this.prisma.companyCustomHoliday.findFirst({
      where: {
        company_custom_holiday_id: holidayId,
        company_id: companyId,
        deleted_at: null,
      },
      select: {
        company_custom_holiday_id: true,
        company_id: true,
        start_date: true,
        end_date: true,
        description: true,
      },
    });

    if (!existing) throw new BadRequestException('Custom holiday not found');
    return existing;
  }

  // -------------------------
  // Public methods
  // -------------------------

  async createByCompany(companyId: string, dto: CreateCustomHolidayDto) {
    await this.assertCompanyExists(companyId);

    const start = this.parseIsoDateToUtc(dto.start_date, 'start_date');
    const end = this.parseIsoDateToUtc(dto.end_date, 'end_date');
    const todayUtc = this.todayUtcDateOnly();

    this.validateRangeAndNotPast(start, end, todayUtc);

    return this.prisma.companyCustomHoliday.create({
      data: {
        company_id: companyId,
        start_date: start,
        end_date: end,
        description: dto.description.trim(),
      },
    });
  }

  async findAllByCompany(companyId: string) {
    return this.prisma.companyCustomHoliday.findMany({
      where: {
        company_id: companyId,
        deleted_at: null,
      },
      orderBy: { start_date: 'asc' },
    });
  }

  async findOneById(company_custom_holiday_id: string) {
    return this.prisma.companyCustomHoliday.findUnique({
      where: { company_custom_holiday_id },
    });
  }

  async findOneByIdByCompany(
    companyId: string,
    company_custom_holiday_id: string,
  ) {
    // lebih efisien: langsung query by company + not deleted
    const data = await this.prisma.companyCustomHoliday.findFirst({
      where: {
        company_custom_holiday_id,
        company_id: companyId,
        deleted_at: null,
      },
    });

    if (!data) {
      throw new BadRequestException('Custom holiday not found');
    }

    return data;
  }

  async updateByCompany(
    companyId: string,
    holidayId: string,
    dto: UpdateCustomHolidayDto,
  ) {
    await this.assertCompanyExists(companyId);

    const existing = await this.findExistingByCompanyOrThrow(
      companyId,
      holidayId,
    );
    const todayUtc = this.todayUtcDateOnly();

    // rule: tidak boleh update jika sudah mulai / hari ini
    this.assertNotStartedYet(existing.start_date, todayUtc, 'update');

    const start = this.parseIsoDateToUtc(dto.start_date, 'start_date');
    const end = this.parseIsoDateToUtc(dto.end_date, 'end_date');

    this.validateRangeAndNotPast(start, end, todayUtc);

    return this.prisma.companyCustomHoliday.update({
      where: { company_custom_holiday_id: holidayId },
      data: {
        start_date: start,
        end_date: end,
        description: dto.description.trim(),
      },
    });
  }

  async removeByCompany(companyId: string, holidayId: string) {
    await this.assertCompanyExists(companyId);

    const existing = await this.findExistingByCompanyOrThrow(
      companyId,
      holidayId,
    );
    const todayUtc = this.todayUtcDateOnly();

    // rule: tidak boleh delete jika sudah mulai / hari ini
    this.assertNotStartedYet(existing.start_date, todayUtc, 'delete');

    return this.prisma.companyCustomHoliday.update({
      where: { company_custom_holiday_id: holidayId },
      data: { deleted_at: new Date() },
    });
  }
}
