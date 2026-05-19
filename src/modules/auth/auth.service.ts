import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { createHash, randomBytes } from 'crypto';

import { User, UserDocument, UserRole } from '../../schemas/user.schema';
import { Token, TokenDocument, TokenType } from '../../schemas/token.schema';
import { UsersService } from '../users/users.service';
import { MailService } from '../../mail/mail.service';
import { JwtPayload } from './strategies/jwt.strategy';

/**
 * Servicio central de autenticación.
 *
 * Responsabilidades:
 *  - Validar credenciales y emitir JWT de sesión.
 *  - Registrar intentos fallidos y bloquear la cuenta.
 *  - Flujo de recuperación de contraseña (token de un solo uso + email).
 *
 * Decisiones:
 *  - El JWT de sesión es stateless (no se persiste).
 *  - El token de reset sí se persiste (hasheado) en la colección `tokens`
 *    para invalidar después de consumirse.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(Token.name) private readonly tokenModel: Model<TokenDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  /**
   * Verifica email + password. Devuelve el usuario si las credenciales
   * son correctas y la cuenta está activa. En caso contrario:
   *  - Credencial inválida: incrementa el contador de fallos.
   *  - Cuenta bloqueada / inactiva: lanza 403 aunque el password sea correcto.
   */
  async validateUser(email: string, password: string): Promise<UserDocument | null> {
    const user = await this.users.findByEmail(email);
    if (!user) return null;

    if (!user.isActive) {
      throw new ForbiddenException(
        'La cuenta está bloqueada. Utilice la recuperación de contraseña o contacte al administrador.',
      );
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      const updated = await this.users.registerFailedLogin(user._id as Types.ObjectId);
      if (updated && !updated.isActive) {
        this.logger.warn(`Cuenta bloqueada por intentos fallidos: ${user.email}`);
      }
      return null;
    }

    await this.users.resetLoginCounters(user._id as Types.ObjectId);
    return user;
  }

  /**
   * Emite un JWT firmado con el payload mínimo necesario.
   */
  issueToken(user: UserDocument): string {
    const payload: JwtPayload = {
      sub: String(user._id),
      email: user.email,
      role: user.role,
    };
    return this.jwt.sign(payload);
  }

  async login(user: UserDocument) {
    return {
      accessToken: this.issueToken(user),
      user: {
        // Los clientes leen `_id` (estándar Mongoose). Dejamos `id` también
        // por compatibilidad por si algún consumidor externo lo espera.
        _id: String(user._id),
        id: String(user._id),
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Recuperación de contraseña
  // ---------------------------------------------------------------------------

  /**
   * Genera un token de reset (24h) y lo envía por correo.
   *
   * Política: respondemos 200 aunque el email no exista, para no revelar
   * qué correos están registrados (mitigación de enumeración).
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      this.logger.debug(`Reset solicitado para email inexistente: ${email}`);
      return;
    }

    // Token crudo (lo que enviamos por correo)
    const raw = randomBytes(32).toString('hex');
    // Guardamos sólo el hash — aunque un atacante obtenga la colección,
    // no puede reutilizar los tokens.
    const hash = createHash('sha256').update(raw).digest('hex');

    const ttlSec = this.parseDurationToSeconds(
      this.config.get<string>('jwt.resetExpiresIn') ?? '24h',
    );
    const expiresAt = new Date(Date.now() + ttlSec * 1000);

    await this.tokenModel.create({
      value: hash,
      type: TokenType.PASSWORD_RESET,
      user: user._id,
      expiresAt,
    });

    const url = `${this.config.get<string>('mail.webResetUrl')}?token=${raw}`;
    await this.mail.sendPasswordReset(user.email, url);
  }

  /**
   * Consume un token de reset: valida, actualiza contraseña, marca como usado
   * y desbloquea la cuenta si estaba bloqueada.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const hash = createHash('sha256').update(rawToken).digest('hex');
    const doc = await this.tokenModel.findOne({
      value: hash,
      type: TokenType.PASSWORD_RESET,
      usedAt: { $exists: false },
    });

    if (!doc) throw new NotFoundException('Token inválido o ya utilizado.');
    if (doc.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Token vencido.');
    }

    await this.users.setPassword(doc.user as Types.ObjectId, newPassword);
    doc.usedAt = new Date();
    await doc.save();
  }

  // ---------------------------------------------------------------------------
  // Utilidades internas
  // ---------------------------------------------------------------------------

  /**
   * Convierte cadenas tipo "24h", "15m", "30s" a segundos.
   * Implementación mínima — para algo más completo usar la lib `ms`.
   */
  private parseDurationToSeconds(d: string): number {
    const m = d.match(/^(\d+)\s*(s|m|h|d)$/);
    if (!m) return 60 * 60 * 24; // default 24h
    const n = Number(m[1]);
    switch (m[2]) {
      case 's': return n;
      case 'm': return n * 60;
      case 'h': return n * 3600;
      case 'd': return n * 86400;
      default: return 86400;
    }
  }
}
