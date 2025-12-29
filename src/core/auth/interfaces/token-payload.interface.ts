export interface TokenPayloadInterface {
  sub: string;
  role: string;
  email: string;
  type: 'access' | 'refresh';
}
