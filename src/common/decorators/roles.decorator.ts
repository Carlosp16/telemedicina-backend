import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../schemas/user.schema';

/**
 * Metadata key para el guard de roles.
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator para restringir el acceso a endpoints según el rol del JWT.
 *
 * Uso:
 *   ￤Roles(UserRole.ADMIN)
 *   ￤Get('access-codes')
 *   listCodes() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
