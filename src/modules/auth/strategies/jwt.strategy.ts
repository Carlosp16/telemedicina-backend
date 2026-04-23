import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { UsersService } from '../../users/users.service';
import { UserRole } from '../../../schemas/user.schema';

/**
 * Forma del payload JWT que viaja dentro del token firmado.
 */
export interface JwtPayload {
  /** ID del usuario (ObjectId serializado como string). */
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

/**
 * Estrategia JWT (Bearer): extrae el token del header Authorization y
 * lo valida con el secreto. Si es válido, consulta al usuario y bloquea
 * si la cuenta ha sido inhabilitada.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret') ?? 'change_me',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Cuenta no disponible. Contacte al administrador.',
      );
    }
    return payload;
  }
}
