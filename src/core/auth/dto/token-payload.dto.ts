export class TokenPayloadDto {
  sub: string;
  role: string;
  email: string;
  type: 'access' | 'refresh';
}
