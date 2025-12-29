/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Test, TestingModule } from '@nestjs/testing';

import { BankService } from './bank.service';
import { PrismaService } from 'src/common/services/prisma/prisma.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

describe('BankService', () => {
  let service: BankService;

  const prisma = {
    bank: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [BankService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(BankService);
  });

  describe('create', () => {
    it('should create bank', async () => {
      prisma.bank.create.mockResolvedValue({ bank_id: 'b1', name: 'BCA' });

      const res = await service.create({ name: 'BCA' } as any);

      expect(prisma.bank.create).toHaveBeenCalledWith({
        data: { name: 'BCA' },
      });
      expect(res).toEqual({ bank_id: 'b1', name: 'BCA' });
    });
  });

  describe('findAll', () => {
    it('should return all banks (not deleted) ordered by name', async () => {
      prisma.bank.findMany.mockResolvedValue([{ bank_id: 'b1' }]);

      const res = await service.findAll();

      expect(prisma.bank.findMany).toHaveBeenCalledWith({
        where: { deleted_at: null },
        orderBy: { name: 'asc' },
      });
      expect(res).toEqual([{ bank_id: 'b1' }]);
    });
  });

  describe('findOne', () => {
    it('should return bank when found', async () => {
      prisma.bank.findFirst.mockResolvedValue({ bank_id: 'b1' });

      const res = await service.findOne('b1');

      expect(prisma.bank.findFirst).toHaveBeenCalledWith({
        where: { bank_id: 'b1', deleted_at: null },
      });
      expect(res).toEqual({ bank_id: 'b1' });
    });

    it('should return null when not found', async () => {
      prisma.bank.findFirst.mockResolvedValue(null);

      const res = await service.findOne('x');

      expect(res).toBeNull();
    });
  });

  describe('mustFindOne', () => {
    it('should return bank when exists', async () => {
      prisma.bank.findFirst.mockResolvedValue({ bank_id: 'b1' });

      const res = await service.mustFindOne('b1');

      expect(res).toEqual({ bank_id: 'b1' });
    });

    it('should throw when bank not found', async () => {
      prisma.bank.findFirst.mockResolvedValue(null);

      await expect(service.mustFindOne('x')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('should throw when bank not found', async () => {
      prisma.bank.findFirst.mockResolvedValue(null);

      await expect(
        service.update('x', { name: 'NEW' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.bank.update).not.toHaveBeenCalled();
    });

    it('should update bank when found', async () => {
      prisma.bank.findFirst.mockResolvedValue({ bank_id: 'b1' });
      prisma.bank.update.mockResolvedValue({ bank_id: 'b1', name: 'NEW' });

      const res = await service.update('b1', { name: 'NEW' } as any);

      expect(prisma.bank.update).toHaveBeenCalledWith({
        where: { bank_id: 'b1' },
        data: { name: 'NEW' },
      });
      expect(res).toEqual({ bank_id: 'b1', name: 'NEW' });
    });
  });

  describe('remove', () => {
    it('should throw when bank not found', async () => {
      prisma.bank.findFirst.mockResolvedValue(null);

      await expect(service.remove('x')).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(prisma.bank.update).not.toHaveBeenCalled();
    });

    it('should soft delete bank when found', async () => {
      prisma.bank.findFirst.mockResolvedValue({ bank_id: 'b1' });
      prisma.bank.update.mockResolvedValue({
        bank_id: 'b1',
        deleted_at: new Date('2025-01-01T00:00:00.000Z'),
      });

      const res = await service.remove('b1');

      expect(prisma.bank.update).toHaveBeenCalledWith({
        where: { bank_id: 'b1' },
        data: { deleted_at: expect.any(Date) },
      });
      expect(res.bank_id).toBe('b1');
    });
  });
});
