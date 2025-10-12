import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'argon2';
import { GoogleOauthService } from 'src/common/services/prisma/google-oauth.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: { findFirst: jest.fn(), create: jest.fn() },
          },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn() },
        },
        {
          provide: GoogleOauthService,
          useValue: {
            getUserData: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should throw if user not found', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.login({ email: 'a@b.com', password: '123' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw if password invalid', async () => {
      const hashed = await hash('correct');
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'a@b.com',
        password: hashed,
      });
      await expect(
        service.login({ email: 'a@b.com', password: '123' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should return user + tokens if credentials valid', async () => {
      const hashed = await hash('123456');
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'a@b.com',
        password: hashed,
      });
      (jwtService.signAsync as jest.Mock).mockImplementation(
        (payload: { sub: string; email: string }) =>
          Promise.resolve(`token-${payload.sub}`),
      );

      const result = await service.login({
        email: 'a@b.com',
        password: '123456',
      });

      expect(result.user).toEqual({
        id: '1',
        email: 'a@b.com',
        password: undefined,
      });
      expect(result.access_token).toBe('token-1');
      expect(result.refresh_token).toBe('token-1');
    });
  });
});
