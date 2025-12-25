import { Injectable } from '@nestjs/common';

@Injectable()
export class PayrollService {
  create() {
    return 'This action adds a new payroll';
  }

  findAll() {
    return `This action returns all payroll`;
  }

  findOne(id: number) {
    return `This action returns a #${id} payroll`;
  }

  update(id: number) {
    return `This action updates a #${id} payroll`;
  }

  remove(id: number) {
    return `This action removes a #${id} payroll`;
  }
}
