import { UserRole } from './entities/user.entity';

/** Shape of the JWT payload, signed on login/register and verified by JwtStrategy. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  schoolName: string | null;
}
