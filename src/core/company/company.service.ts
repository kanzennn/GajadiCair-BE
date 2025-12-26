import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { SubscriptionService } from '../subscription/subscription.service';
import { convertFilename } from 'src/utils/convertString.utils';
import { S3Service } from 'src/common/services/s3/s3.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class CompanyService {
  constructor(
    private readonly subscriptionsService: SubscriptionService,
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async getAvailableSeats(company_id: string) {
    const company = await this.prisma.company.findUnique({
      where: { company_id, deleted_at: null },
    });

    const totalEmployee = await this.prisma.employee.count({
      where: { company_id, deleted_at: null },
    });

    let seat_capacity = 0;

    if (!company) {
      throw new BadRequestException('Company not found');
    }

    const subscriptionStatus =
      await this.subscriptionsService.getSubscriptionStatus(company_id);

    if (subscriptionStatus.level_plan === 0) {
      seat_capacity = 5;
    } else if (subscriptionStatus.level_plan === 1) {
      seat_capacity = 20;
    } else if (subscriptionStatus.level_plan === 2) {
      return {
        seat_taken: totalEmployee,
        seat_availability: null,
        seat_capacity: null,
      };
    }

    const availableSeats = seat_capacity - totalEmployee;
    return {
      seat_taken: totalEmployee,
      seat_availability: availableSeats,
      seat_capacity: seat_capacity,
    };
  }

  async getCompanyById(id: string) {
    return await this.prisma.company.findUnique({
      where: { company_id: id },
    });
  }

  async updateCompanyProfile(
    company_id: string,
    dto: UpdateProfileDto,
    file?: Express.Multer.File,
  ) {
    const checkIsCompanyExist = await this.prisma.company.findUnique({
      where: { company_id },
    });

    if (!checkIsCompanyExist) {
      throw new BadRequestException('Company not found');
    }

    if (file) {
      const key = `company/profile-picture/${Date.now()}-${convertFilename(file.originalname)}`;

      const picture = await this.s3.uploadBuffer({
        key,
        buffer: file.buffer,
        contentType: file.mimetype,
        cacheControl: 'public, max-age=31536000',
      });

      dto.avatar_uri = picture.key;
    }

    const updateData = await this.prisma.company.update({
      where: { company_id },
      data: dto,
    });

    return updateData;
  }
}
