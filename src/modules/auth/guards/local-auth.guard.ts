import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard que activa la estrategia local. Se usa sólo en `POST /auth/login`.
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
