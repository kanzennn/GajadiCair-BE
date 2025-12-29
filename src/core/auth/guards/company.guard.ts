import { AuthGuard } from '@nestjs/passport';

export class CompanyAuthGuard extends AuthGuard('jwt-company') {}
