import { Test, TestingModule } from '@nestjs/testing';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';

describe('CompanyController', () => {
  let controller: CompanyController;

  const companyService = {
    getCompanyById: jest.fn(),
    updateCompanyProfile: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompanyController],
      providers: [{ provide: CompanyService, useValue: companyService }],
    }).compile();

    controller = module.get(CompanyController);
  });

  describe('getProfile', () => {
    it('should return profile (password undefined)', async () => {
      companyService.getCompanyById.mockResolvedValue({
        company_id: 'c1',
        name: 'ACME',
        email: 'a@a.com',
        password: 'secret',
      });

      const req: any = { user: { sub: 'c1' } };

      const res = await controller.getProfile(req);

      expect(companyService.getCompanyById).toHaveBeenCalledWith('c1');

      // successResponse biasanya bentuknya { statusCode, message, data }.
      // Karena helper kamu tidak di-mock, kita cek struktur minimal yang aman:
      expect(res.data.company_id).toBe('c1');
      expect(res.data.password).toBeUndefined();
      expect(res.message).toBe('Profile fetched successfully');
    });
  });

  describe('updateProfile', () => {
    it('should update profile without file', async () => {
      companyService.updateCompanyProfile.mockResolvedValue({
        company_id: 'c1',
        name: 'NEW',
        password: 'secret',
      });

      const req: any = { user: { sub: 'c1' } };
      const dto: any = { name: 'NEW' };

      const res = await controller.updateProfile(req, dto, undefined);

      expect(companyService.updateCompanyProfile).toHaveBeenCalledWith(
        'c1',
        dto,
        undefined,
      );

      expect(res.data.company_id).toBe('c1');
      expect(res.data.password).toBeUndefined();
      expect(res.message).toBe('Profile updated successfully');
    });

    it('should update profile with file', async () => {
      companyService.updateCompanyProfile.mockResolvedValue({
        company_id: 'c1',
        name: 'NEW',
        avatar_uri: 'company/profile-picture/x',
        password: 'secret',
      });

      const req: any = { user: { sub: 'c1' } };
      const dto: any = { name: 'NEW' };
      const file: any = { originalname: 'a.png', mimetype: 'image/png' };

      const res = await controller.updateProfile(req, dto, file);

      expect(companyService.updateCompanyProfile).toHaveBeenCalledWith(
        'c1',
        dto,
        file,
      );

      expect(res.data.avatar_uri).toBe('company/profile-picture/x');
      expect(res.data.password).toBeUndefined();
      expect(res.message).toBe('Profile updated successfully');
    });

    it('should bubble up errors from service', async () => {
      companyService.updateCompanyProfile.mockRejectedValue(new Error('boom'));

      const req: any = { user: { sub: 'c1' } };
      const dto: any = { name: 'NEW' };

      await expect(
        controller.updateProfile(req, dto, undefined),
      ).rejects.toThrow('boom');
    });
  });
});
