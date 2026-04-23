import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard para proteger endpoints HTTP con Bearer JWT.
 * Equivalente funcional a `AuthGuard('jwt')`, definido como clase para
 * que quede claro en los controllers y se pueda extender a futuro.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
