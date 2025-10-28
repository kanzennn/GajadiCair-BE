import { Employee } from '../../employee/entities/employee.entity';

export class Bank {
  bank_id: string;
  name: string;
  code: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;

  employees?: Employee[];
}
