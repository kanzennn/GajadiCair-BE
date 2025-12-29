import { AttendanceStatus } from 'generated/prisma';

export class EmployeeAttendance {
  employee_attendance_id?: string;
  employee_id?: string;

  attendance_date?: Date | null;

  check_in_time?: Date | null;
  check_out_time?: Date | null;

  total_work_hours?: number | null;

  status: AttendanceStatus;
  absent_reason?: string | null;

  late_minutes: number | null;
  is_late?: boolean;

  created_at?: Date;
  updated_at?: Date;
}
