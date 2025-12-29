import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { S3Service } from 'src/common/services/s3/s3.service';

import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { convertFilename } from 'src/utils/convertString.utils';

import { SubscriptionService } from '../subscription/subscription.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

type SeatsResult = {
  seat_taken: number;
  seat_availability: number | null;
  seat_capacity: number | null;
};

@Injectable()
export class CompanyService {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async getCompanyById(company_id: string) {
    return this.prisma.company.findUnique({
      where: { company_id },
    });
  }

  async getAvailableSeats(company_id: string): Promise<SeatsResult> {
    const company = await this.prisma.company.findFirst({
      where: { company_id, deleted_at: null },
      select: { company_id: true },
    });

    if (!company) throw new BadRequestException('Company not found');

    const [totalEmployee, subscriptionStatus] = await Promise.all([
      this.prisma.employee.count({
        where: { company_id, deleted_at: null },
      }),
      this.subscriptionService.getSubscriptionStatus(company_id),
    ]);

    // Level 2: unlimited seat
    if (subscriptionStatus.level_plan === 2) {
      return {
        seat_taken: totalEmployee,
        seat_availability: null,
        seat_capacity: null,
      };
    }

    const seat_capacity = subscriptionStatus.level_plan === 1 ? 20 : 5; // level 0 => 5, level 1 => 20
    return {
      seat_taken: totalEmployee,
      seat_capacity,
      seat_availability: Math.max(0, seat_capacity - totalEmployee),
    };
  }

  async updateCompanyProfile(
    company_id: string,
    dto: UpdateProfileDto,
    file?: Express.Multer.File,
  ) {
    const exists = await this.prisma.company.findUnique({
      where: { company_id },
      select: { company_id: true },
    });

    if (!exists) throw new BadRequestException('Company not found');

    const data: UpdateProfileDto = { ...dto };

    if (file) {
      const key = `company/profile-picture/${Date.now()}-${convertFilename(file.originalname)}`;

      const uploaded = await this.s3.uploadBuffer({
        key,
        buffer: file.buffer,
        contentType: file.mimetype,
        cacheControl: 'public, max-age=31536000',
      });

      data.avatar_uri = uploaded.key;
    }

    return this.prisma.company.update({
      where: { company_id },
      data,
    });
  }
}
