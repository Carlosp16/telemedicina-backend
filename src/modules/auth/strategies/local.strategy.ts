import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

import { AuthService } from '../auth.service';
import { UserDocument } from '../../../schemas/user.schema';

/**
 * Estrategia local (email + password). Se usa únicamente en el endpoint
 * `POST /auth/login` a través de `LocalAuthGuard`.
 *
 * La validación concreta vive en `AuthService.validateUser`, de modo que
 * toda la lógica (bcrypt, bloqueo por intentos) quede en el servicio.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly auth: AuthService) {
    super({ usernameField: 'email', passwordField: 'password' });
  }

  async validate(email: string, password: string): Promise<UserDocument> {
    const user = await this.auth.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Credenciales inválidas.');
    return user;
  }
}
