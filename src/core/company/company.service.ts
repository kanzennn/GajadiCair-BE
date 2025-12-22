import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { UpdateProfileDto } from '../auth/dto/update-profile.dto';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompanyById(id: string) {
    return await this.prisma.company.findUnique({
      where: { company_id: id },
    });
  }

  async updateCompanyProfile(company_id: string, dto: UpdateProfileDto) {
    const checkIsCompanyExist = await this.prisma.company.findUnique({
      where: { company_id },
    });

    if (!checkIsCompanyExist) {
      throw new BadRequestException('Company not found');
    }

    const updateData = await this.prisma.company.update({
      where: { company_id },
      data: dto,
    });

    return updateData;
  }
}
