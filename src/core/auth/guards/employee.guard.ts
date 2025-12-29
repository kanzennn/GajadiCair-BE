import { AuthGuard } from '@nestjs/passport';

export class EmployeeAuthGuard extends AuthGuard('jwt-employee') {}
