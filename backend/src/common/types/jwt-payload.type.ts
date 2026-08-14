import { Role, Permission } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  permissions: Permission[];
  iat?: number;
  exp?: number;
}
