export class Employee {
  employee_id: string;
  name: string;
  company_id: string;
  password: string;
  is_active: boolean;
  base_salary: number;
  face_id?: string;
  bank_id?: string;
  bank_account_number?: string;
  tax_identification_number?: string;
  avatar_uri?: string;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;

  // Relations
  //   @ApiProperty({ type: () => Company })
  //   company?: Company;

  //   @ApiProperty({ type: () => Bank, required: false })
  //   bank?: Bank | null;

  //   @ApiProperty({ type: () => [AttendanceLog], required: false })
  //   attendance_logs?: AttendanceLog[];

  //   @ApiProperty({ type: () => [EmployeeAttendance], required: false })
  //   attendances?: EmployeeAttendance[];

  //   @ApiProperty({ type: () => [PayrollLog], required: false })
  //   payroll_logs?: PayrollLog[];
}
