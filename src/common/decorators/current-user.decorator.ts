import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';

/**
 * Extrae el usuario autenticado (payload JWT) de la request.
 *
 * Uso:
 *   ￤UseGuards(JwtAuthGuard)
 *   ￤Get('me')
 *   me(￤CurrentUser() user: JwtPayload) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtPayload;
  },
);
