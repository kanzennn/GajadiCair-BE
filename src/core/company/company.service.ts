import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma/prisma.service';

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompanyById(id: string) {
    return await this.prisma.company.findUnique({
      where: { company_id: id },
    });
  }
}
