/* eslint-disable @typescript-eslint/no-unsafe-assignment */

// bank.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';

import { BankController } from './bank.controller';
import { BankService } from './bank.service';

import { BadRequestException } from 'src/common/exceptions/badRequest.exception';
import { successResponse } from 'src/utils/response.utils';

describe('BankController', () => {
  let controller: BankController;

  const bankService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BankController],
      providers: [{ provide: BankService, useValue: bankService }],
    }).compile();

    controller = module.get(BankController);
  });

  describe('create', () => {
    it('should create bank and return success response', async () => {
      bankService.create.mockResolvedValue({ bank_id: 'b1', name: 'BCA' });

      const res = await controller.create({ name: 'BCA' } as any);

      expect(bankService.create).toHaveBeenCalledWith({ name: 'BCA' });
      expect(res).toEqual(
        successResponse(
          { bank_id: 'b1', name: 'BCA' },
          'Bank created successfully',
          201,
        ),
      );
    });
  });

  describe('findAll', () => {
    it('should return list of banks', async () => {
      bankService.findAll.mockResolvedValue([{ bank_id: 'b1' }]);

      const res = await controller.findAll();

      expect(bankService.findAll).toHaveBeenCalled();
      expect(res).toEqual(
        successResponse([{ bank_id: 'b1' }], 'Banks retrieved successfully'),
      );
    });
  });

  describe('findOne', () => {
    it('should return bank when found', async () => {
      bankService.findOne.mockResolvedValue({ bank_id: 'b1', name: 'BCA' });

      const res = await controller.findOne('b1');

      expect(bankService.findOne).toHaveBeenCalledWith('b1');
      expect(res).toEqual(
        successResponse(
          { bank_id: 'b1', name: 'BCA' },
          'Bank retrieved successfully',
        ),
      );
    });

    it('should throw when bank not found', async () => {
      bankService.findOne.mockResolvedValue(null);

      await expect(controller.findOne('x')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('should throw when bank not found', async () => {
      bankService.findOne.mockResolvedValue(null);

      await expect(
        controller.update('x', { name: 'NEW' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(bankService.update).not.toHaveBeenCalled();
    });

    it('should update bank when found', async () => {
      bankService.findOne.mockResolvedValue({ bank_id: 'b1', name: 'BCA' });
      bankService.update.mockResolvedValue({ bank_id: 'b1', name: 'NEW' });

      const res = await controller.update('b1', { name: 'NEW' } as any);

      expect(bankService.findOne).toHaveBeenCalledWith('b1');
      expect(bankService.update).toHaveBeenCalledWith('b1', { name: 'NEW' });

      expect(res).toEqual(
        successResponse(
          { bank_id: 'b1', name: 'NEW' },
          'Bank updated successfully',
        ),
      );
    });
  });

  describe('remove', () => {
    it('should throw when bank not found', async () => {
      bankService.findOne.mockResolvedValue(null);

      await expect(controller.remove('x')).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(bankService.remove).not.toHaveBeenCalled();
    });

    it('should remove bank when found', async () => {
      bankService.findOne.mockResolvedValue({ bank_id: 'b1', name: 'BCA' });
      bankService.remove.mockResolvedValue({
        bank_id: 'b1',
        deleted_at: new Date('2025-01-01T00:00:00.000Z'),
      });

      const res = await controller.remove('b1');

      expect(bankService.findOne).toHaveBeenCalledWith('b1');
      expect(bankService.remove).toHaveBeenCalledWith('b1');

      expect(res).toEqual(
        successResponse(
          {
            bank_id: 'b1',
            deleted_at: expect.any(Date),
          },
          'Bank removed successfully',
        ),
      );
    });
  });
});
