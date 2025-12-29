/* eslint-disable @typescript-eslint/unbound-method */
// auth.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';

import { AuthControllerV1 } from './auth.controller';
import { AuthService } from './auth.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { LoginWithGoogleAuthDto } from './dto/login-with-google.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

describe('AuthControllerV1', () => {
  let controller: AuthControllerV1;

  const authService = {
    loginCompany: jest.fn(),
    googleLoginCompany: jest.fn(),
    registerCompany: jest.fn(),
    changeCompanyPassword: jest.fn(),
    refreshCompanyToken: jest.fn(),

    loginEmployee: jest.fn(),
    changeEmployeePassword: jest.fn(),
    refreshEmployeeToken: jest.fn(),
  };

  const makeRes = (): Response => {
    return {
      cookie: jest.fn(),
    } as unknown as Response;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthControllerV1],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get(AuthControllerV1);
  });

  describe('company/login', () => {
    it('should set refresh token cookie and return response', async () => {
      authService.loginCompany.mockResolvedValue({
        company: { company_id: 'c1', email: 'a@a.com' },
        access_token: 'access',
        refresh_token: 'refresh',
      });

      const res = makeRes();

      const result = await controller.loginCompany(
        { email: 'a@a.com', password: 'x' } as LoginAuthDto,
        res,
      );

      expect(authService.loginCompany).toHaveBeenCalledWith({
        email: 'a@a.com',
        password: 'x',
      });

      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh',
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'none',
          path: '/',
        }),
      );

      // don't over-couple to successResponse shape
      expect(result).toBeDefined();
    });
  });

  describe('company/login/google', () => {
    it('should set refresh token cookie and return response', async () => {
      authService.googleLoginCompany.mockResolvedValue({
        company: { company_id: 'c1' },
        access_token: 'access',
        refresh_token: 'refresh',
      });

      const res = makeRes();

      const result = await controller.loginWithGoogleCompany(
        { id_token: 'idToken' } as LoginWithGoogleAuthDto,
        res,
      );

      expect(authService.googleLoginCompany).toHaveBeenCalledWith('idToken');
      expect(res.cookie).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('company/register', () => {
    it('should set refresh token cookie and return response', async () => {
      authService.registerCompany.mockResolvedValue({
        company: { company_id: 'c1' },
        access_token: 'access',
        refresh_token: 'refresh',
      });

      const res = makeRes();

      const result = await controller.registerCompany(
        { email: 'a@a.com', name: 'A', password: 'p' },
        res,
      );

      expect(authService.registerCompany).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('company/change-password', () => {
    it('should call authService.changeCompanyPassword', async () => {
      authService.changeCompanyPassword.mockResolvedValue({ success: true });

      const req = { user: { sub: 'c1' } };
      const dto: ChangePasswordDto = {
        old_password: 'old',
        new_password: 'new',
        confirm_password: 'new',
      };

      const result = await controller.changeCompanyPassword(req as any, dto);

      expect(authService.changeCompanyPassword).toHaveBeenCalledWith(
        'c1',
        'old',
        'new',
      );
      expect(result).toBeDefined();
    });
  });

  describe('company/refresh-token', () => {
    it('should throw BadRequestException when cookie missing', async () => {
      const req = { cookies: {} };

      await expect(
        controller.refreshCompanyToken(req as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should call authService.refreshCompanyToken with cookie', async () => {
      authService.refreshCompanyToken.mockResolvedValue({
        access_token: 'new_access',
      });

      const req = { cookies: { refresh_token: 'rt' } };

      const result = await controller.refreshCompanyToken(req as any);

      expect(authService.refreshCompanyToken).toHaveBeenCalledWith('rt');
      expect(result).toBeDefined();
    });
  });

  describe('employee/login', () => {
    it('should set refresh token cookie and return response', async () => {
      authService.loginEmployee.mockResolvedValue({
        employee: { employee_id: 'e1', username: 'emp' },
        access_token: 'access',
        refresh_token: 'refresh',
      });

      const res = makeRes();

      const result = await controller.loginEmployee(
        { username: 'emp', password: 'p', company_identifier: 'CID' } as any,
        res,
      );

      expect(authService.loginEmployee).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('employee/change-password', () => {
    it('should call authService.changeEmployeePassword', async () => {
      authService.changeEmployeePassword.mockResolvedValue({ success: true });

      const req = { user: { sub: 'e1' } };
      const dto = { old_password: 'old', new_password: 'new' };

      const result = await controller.changeEmployeePassword(
        req as any,
        dto as any,
      );

      expect(authService.changeEmployeePassword).toHaveBeenCalledWith(
        'e1',
        'old',
        'new',
      );
      expect(result).toBeDefined();
    });
  });

  describe('employee/refresh-token', () => {
    it('should throw BadRequestException when cookie missing', async () => {
      const req = { cookies: {} };

      await expect(
        controller.refreshEmployeeToken(req as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should call authService.refreshEmployeeToken with cookie', async () => {
      authService.refreshEmployeeToken.mockResolvedValue({
        access_token: 'new_access',
      });

      const req = { cookies: { refresh_token: 'rt' } };

      const result = await controller.refreshEmployeeToken(req as any);

      expect(authService.refreshEmployeeToken).toHaveBeenCalledWith('rt');
      expect(result).toBeDefined();
    });
  });
});
