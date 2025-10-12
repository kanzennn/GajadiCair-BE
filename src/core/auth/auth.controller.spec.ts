import { Test, TestingModule } from '@nestjs/testing';
import { AuthControllerV1 } from './auth.controller';
import { AuthService } from './auth.service';
import type { Response } from 'express';
import { LoginAuthDto } from './dto/login-auth.dto';

describe('AuthControllerV1', () => {
  let controller: AuthControllerV1;
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthControllerV1],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn().mockResolvedValue({
              user: { id: '1', email: 'a@b.com', password: undefined },
              access_token: 'access-token',
              refresh_token: 'refresh-token',
            }),
            googleLogin: jest.fn().mockResolvedValue({ userId: 'google1' }),
            register: jest
              .fn()
              .mockResolvedValue({ id: '2', email: 'b@b.com' }),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthControllerV1>(AuthControllerV1);
    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('AuthService', () => {
    it('service should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('login', () => {
    it('should return user and set tokens', async () => {
      const res = {
        setHeader: jest.fn(() => undefined),
        cookie: jest.fn(() => undefined),
      } as unknown as Response;

      const dto: LoginAuthDto = { email: 'a@b.com', password: '123456' };
      const result = await controller.login(dto, res);

      expect(result).toEqual({
        id: '1',
        email: 'a@b.com',
        password: undefined,
      });
      expect(res.setHeader).toHaveBeenCalledWith(
        'Authorization',
        'Bearer access-token',
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-token',
        expect.any(Object),
      );
    });
  });

  describe('loginWithGoogle', () => {
    it('should call service.googleLogin', async () => {
      const result = await controller.loginWithGoogle({ id_token: 'token' });
      expect(result).toEqual({ userId: 'google1' });
    });
  });

  describe('register', () => {
    it('should call service.register', async () => {
      const result = await controller.register({
        name: 'test',
        email: 'b@b.com',
        password: '123456',
      });

      expect(result).toEqual({ id: '2', email: 'b@b.com' });
    });
  });
});
