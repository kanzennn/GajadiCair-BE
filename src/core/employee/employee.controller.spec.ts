// employee.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';

import { EmployeeController } from './employee.controller';

import { EmployeeService } from './employee.service';
import { CompanyService } from '../company/company.service';
import { BankService } from '../bank/bank.service';
import { SubscriptionService } from '../subscription/subscription.service';

import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

describe('EmployeeController', () => {
  let controller: EmployeeController;

  // ======= Mocks =======
  const employeeService = {
    getEmployeeById: jest.fn(),
    updateEmployeeProfile: jest.fn(),
    createEmployeeByCompany: jest.fn(),
    getEmployeesByCompany: jest.fn(),
    getEmployeeByIdByCompany: jest.fn(),
    getEmployeeByIdIncludeCompany: jest.fn(),
    updateEmployeeByIdByCompany: jest.fn(),
    deleteEmployeeByIdByCompany: jest.fn(),
  };

  const companyService = {
    getAvailableSeats: jest.fn(),
  };

  const bankService = {
    findOne: jest.fn(),
  };

  const subscriptionService = {
    getSubscriptionStatus: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeeController],
      providers: [
        { provide: EmployeeService, useValue: employeeService },
        { provide: CompanyService, useValue: companyService },
        { provide: BankService, useValue: bankService },
        { provide: SubscriptionService, useValue: subscriptionService },
      ],
    }).compile();

    controller = module.get(EmployeeController);
  });

  const makeReq = (sub: string) => ({ user: { sub } }) as any;

  describe('getEmployeeProfile', () => {
    it('should throw when employee not found', async () => {
      employeeService.getEmployeeByIdIncludeCompany.mockResolvedValue(null);

      await expect(
        controller.getEmployeeProfile(makeReq('e1')),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(
        employeeService.getEmployeeByIdIncludeCompany,
      ).toHaveBeenCalledWith('e1');
      expect(subscriptionService.getSubscriptionStatus).not.toHaveBeenCalled();
    });

    it('should return employee profile with subscription_status and password undefined', async () => {
      employeeService.getEmployeeByIdIncludeCompany.mockResolvedValue({
        employee_id: 'e1',
        company_id: 'c1',
        email: 'e@e.com',
        password: 'hashed:any',
        company: { company_id: 'c1', name: 'PT ABC' }, // include company karena include: { company: true }
      });

      // controller cuma "pass-through" apapun return-nya, jadi mock bebas
      subscriptionService.getSubscriptionStatus.mockResolvedValue({
        level_plan: 1,
        plan_expiration: new Date('2030-01-01T00:00:00.000Z'),
      });

      const res = await controller.getEmployeeProfile(makeReq('e1'));

      expect(
        employeeService.getEmployeeByIdIncludeCompany,
      ).toHaveBeenCalledWith('e1');

      expect(subscriptionService.getSubscriptionStatus).toHaveBeenCalledWith(
        'c1',
      );

      expect(res).toEqual({
        statusCode: 200,
        message: 'Profile fetched successfully',
        data: {
          employee_id: 'e1',
          company_id: 'c1',
          email: 'e@e.com',
          company: { company_id: 'c1', name: 'PT ABC' },
          subscription_status: {
            level_plan: 1,
            plan_expiration: new Date('2030-01-01T00:00:00.000Z'),
          },
          password: undefined,
        },
        errors: null,
      });
    });
  });

  describe('updateEmployeeProfile', () => {
    it('should call service and return updated profile', async () => {
      employeeService.updateEmployeeProfile.mockResolvedValue({
        employee_id: 'e1',
        name: 'New',
        password: undefined,
      });

      const dto = { name: 'New' } as any;
      const file = { originalname: 'a.png' } as any;

      const res = await controller.updateEmployeeProfile(
        makeReq('e1'),
        dto,
        file,
      );

      expect(employeeService.updateEmployeeProfile).toHaveBeenCalledWith(
        'e1',
        dto,
        file,
      );

      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Profile updated successfully',
        data: {
          employee_id: 'e1',
          name: 'New',
          password: undefined,
        },
      });
    });
  });

  describe('createEmployee', () => {
    it('should throw when bank not found', async () => {
      bankService.findOne.mockResolvedValue(null);

      await expect(
        controller.createEmployee(makeReq('c1'), { bank_id: 'b1' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(bankService.findOne).toHaveBeenCalledWith('b1');
      expect(employeeService.createEmployeeByCompany).not.toHaveBeenCalled();
    });

    it('should create employee and return 201', async () => {
      bankService.findOne.mockResolvedValue({ bank_id: 'b1' });

      employeeService.createEmployeeByCompany.mockResolvedValue({
        employee_id: 'e1',
        password: undefined,
      });

      const dto = { bank_id: 'b1', username: 'u' } as any;

      const res = await controller.createEmployee(makeReq('c1'), dto);

      expect(employeeService.createEmployeeByCompany).toHaveBeenCalledWith(
        'c1',
        dto,
      );

      expect(res).toMatchObject({
        statusCode: 201,
        message: 'Employee created successfully',
        data: { employee_id: 'e1', password: undefined },
      });
    });
  });

  describe('getEmployees', () => {
    it('should return employees and availableSeats', async () => {
      employeeService.getEmployeesByCompany.mockResolvedValue([
        { employee_id: 'e1' },
      ]);
      companyService.getAvailableSeats.mockResolvedValue({
        seat_availability: 10,
      });

      const res = await controller.getEmployees(makeReq('c1'));

      expect(employeeService.getEmployeesByCompany).toHaveBeenCalledWith('c1');
      expect(companyService.getAvailableSeats).toHaveBeenCalledWith('c1');

      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Employees retrieved successfully',
        data: {
          employees: [{ employee_id: 'e1' }],
          availableSeats: { seat_availability: 10 },
        },
      });
    });
  });

  describe('getEmployeeById', () => {
    it('should return employee', async () => {
      employeeService.getEmployeeByIdByCompany.mockResolvedValue({
        employee_id: 'e1',
        password: undefined,
      });

      const res = await controller.getEmployeeById(makeReq('c1'), 'e1');

      expect(employeeService.getEmployeeByIdByCompany).toHaveBeenCalledWith(
        'c1',
        'e1',
      );

      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Employee retrieved successfully',
        data: { employee_id: 'e1', password: undefined },
      });
    });
  });

  describe('updateEmployee', () => {
    it('should validate employee exists first', async () => {
      employeeService.getEmployeeByIdByCompany.mockResolvedValue({
        employee_id: 'e1',
      });
      bankService.findOne.mockResolvedValue({ bank_id: 'b1' });
      employeeService.updateEmployeeByIdByCompany.mockResolvedValue({
        employee_id: 'e1',
      });

      const dto = { bank_id: 'b1', name: 'N' } as any;

      const res = await controller.updateEmployee(makeReq('c1'), 'e1', dto);

      expect(employeeService.getEmployeeByIdByCompany).toHaveBeenCalledWith(
        'c1',
        'e1',
      );
      expect(bankService.findOne).toHaveBeenCalledWith('b1');
      expect(employeeService.updateEmployeeByIdByCompany).toHaveBeenCalledWith(
        'c1',
        'e1',
        dto,
      );

      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Employee updated successfully',
      });
    });

    it('should throw when dto.bank_id provided but bank not found', async () => {
      employeeService.getEmployeeByIdByCompany.mockResolvedValue({
        employee_id: 'e1',
      });
      bankService.findOne.mockResolvedValue(null);

      await expect(
        controller.updateEmployee(makeReq('c1'), 'e1', {
          bank_id: 'b1',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(
        employeeService.updateEmployeeByIdByCompany,
      ).not.toHaveBeenCalled();
    });

    it('should skip bank check when dto.bank_id not provided', async () => {
      employeeService.getEmployeeByIdByCompany.mockResolvedValue({
        employee_id: 'e1',
      });
      employeeService.updateEmployeeByIdByCompany.mockResolvedValue({
        employee_id: 'e1',
      });

      const dto = { name: 'N' } as any;

      const res = await controller.updateEmployee(makeReq('c1'), 'e1', dto);

      expect(bankService.findOne).not.toHaveBeenCalled();
      expect(employeeService.updateEmployeeByIdByCompany).toHaveBeenCalledWith(
        'c1',
        'e1',
        dto,
      );

      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Employee updated successfully',
      });
    });
  });

  describe('deleteEmployee', () => {
    it('should throw when delete returns falsy', async () => {
      employeeService.getEmployeeByIdByCompany.mockResolvedValue({
        employee_id: 'e1',
      });
      employeeService.deleteEmployeeByIdByCompany.mockResolvedValue(null);

      await expect(
        controller.deleteEmployee(makeReq('c1'), 'e1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should delete employee and return success', async () => {
      employeeService.getEmployeeByIdByCompany.mockResolvedValue({
        employee_id: 'e1',
      });
      employeeService.deleteEmployeeByIdByCompany.mockResolvedValue({
        employee_id: 'e1',
        deleted_at: new Date(),
      });

      const res = await controller.deleteEmployee(makeReq('c1'), 'e1');

      expect(employeeService.getEmployeeByIdByCompany).toHaveBeenCalledWith(
        'c1',
        'e1',
      );
      expect(employeeService.deleteEmployeeByIdByCompany).toHaveBeenCalledWith(
        'c1',
        'e1',
      );

      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Employee deleted successfully',
        data: {
          employee_id: 'e1',
          deleted_at: expect.any(Date),
        },
      });
    });
  });
});
