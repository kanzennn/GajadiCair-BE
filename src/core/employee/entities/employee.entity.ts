import { EmployeeAttendance } from 'src/core/attendance/entities/employee-attendance.entity';

export class Employee {
  employee_id: string;
  company_id?: string;
  email?: string;
  name?: string;
  avatar_uri?: string | null;
  base_salary: number;
  is_active?: boolean;
  is_face_enrolled?: boolean;
  bank_id?: string | null;
  bank_account_number?: string | null;
  tax_identification_number?: string | null;
  last_login?: Date | string | null;
  created_at?: Date | string;
  updated_at?: Date | string;
  deleted_at?: Date | string | null;

  // Relations
  //   @ApiProperty({ type: () => Company })
  //   company?: Company;

  //   @ApiProperty({ type: () => Bank, required: false })
  //   bank?: Bank | null;

  //   @ApiProperty({ type: () => [AttendanceLog], required: false })
  //   attendance_logs?: AttendanceLog[];

  attendances: EmployeeAttendance[];

  //   @ApiProperty({ type: () => [PayrollLog], required: false })
  //   payroll_logs?: PayrollLog[];
}
