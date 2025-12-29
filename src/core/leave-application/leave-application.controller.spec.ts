/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// leave-application.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';

import { LeaveApplicationController } from './leave-application.controller';
import { LeaveApplicationService } from './leave-application.service';

import { S3Service } from 'src/common/services/s3/s3.service';
import { BadRequestException } from 'src/common/exceptions/badRequest.exception';

describe('LeaveApplicationController', () => {
  let controller: LeaveApplicationController;

  // ======= Mocks =======
  const leaveApplicationService = {
    getEmployeeLeaveApplications: jest.fn(),
    create: jest.fn(),
    getCompanyLeaveApplications: jest.fn(),
    updateLeaveApplicationStatus: jest.fn(),
  };

  const s3 = {
    uploadBuffer: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeaveApplicationController],
      providers: [
        { provide: LeaveApplicationService, useValue: leaveApplicationService },
        { provide: S3Service, useValue: s3 },
      ],
    }).compile();

    controller = module.get(LeaveApplicationController);
  });

  const makeReq = (sub: string) => ({ user: { sub } }) as any;

  // ===================== Employee =====================

  describe('getEmployeeLeaveApplications', () => {
    it('should return employee leave applications', async () => {
      leaveApplicationService.getEmployeeLeaveApplications.mockResolvedValue([
        { id: 1 },
      ]);

      const res = await controller.getEmployeeLeaveApplications(makeReq('e1'));

      expect(
        leaveApplicationService.getEmployeeLeaveApplications,
      ).toHaveBeenCalledWith('e1');

      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Leave applications fetched successfully',
        data: [{ id: 1 }],
      });
    });
  });

  describe('createApplication', () => {
    it('should throw when attachment file is missing', async () => {
      await expect(
        controller.createApplication(undefined as any, makeReq('e1'), {
          start_date: '2026-01-01',
          end_date: '2026-01-01',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(s3.uploadBuffer).not.toHaveBeenCalled();
      expect(leaveApplicationService.create).not.toHaveBeenCalled();
    });

    it('should upload attachment to s3 and create leave application', async () => {
      s3.uploadBuffer.mockResolvedValue({ key: 's3/key.png' });
      leaveApplicationService.create.mockResolvedValue({ id: 'la1' });

      const file = {
        originalname: 'surat sakit.png',
        mimetype: 'image/png',
        buffer: Buffer.from('x'),
      } as any;

      const dto: any = {
        start_date: '2026-01-01',
        end_date: '2026-01-03',
        reason: 'Sakit',
        type: 'SICK',
        attachment_uri: undefined,
      };

      const res = await controller.createApplication(file, makeReq('e1'), dto);

      expect(s3.uploadBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          key: expect.stringMatching(/^company\/leave-application\/\d+-/),
          buffer: file.buffer,
          contentType: 'image/png',
          cacheControl: 'public, max-age=31536000',
        }),
      );

      // controller mutates dto.attachment_uri
      expect(dto.attachment_uri).toBe('s3/key.png');

      expect(leaveApplicationService.create).toHaveBeenCalledWith('e1', dto);

      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Leave application created successfully',
        data: { id: 'la1' },
      });
    });
  });

  // ===================== Company =====================

  describe('getCompanyLeaveApplications', () => {
    it('should return company leave applications', async () => {
      leaveApplicationService.getCompanyLeaveApplications.mockResolvedValue([
        { id: 1 },
      ]);

      const res = await controller.getCompanyLeaveApplications(makeReq('c1'));

      expect(
        leaveApplicationService.getCompanyLeaveApplications,
      ).toHaveBeenCalledWith('c1');

      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Leave applications fetched successfully',
        data: [{ id: 1 }],
      });
    });
  });

  describe('updateCompanyLeaveApplication', () => {
    it('should update leave application status', async () => {
      leaveApplicationService.updateLeaveApplicationStatus.mockResolvedValue({
        employee_leave_application_id: 'la1',
        status: 1,
      });

      const dto = {
        employee_leave_application_id: 'la1',
        is_approve: true,
      } as any;

      const res = await controller.updateCompanyLeaveApplication(
        makeReq('c1'),
        dto,
      );

      expect(
        leaveApplicationService.updateLeaveApplicationStatus,
      ).toHaveBeenCalledWith('c1', dto);

      expect(res).toMatchObject({
        statusCode: 200,
        message: 'Leave application status updated successfully',
        data: { employee_leave_application_id: 'la1', status: 1 },
      });
    });
  });
});
