import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';

import { JwtPayload } from '../strategies/jwt.strategy';

/**
 * Guard para sockets (WebSockets / Socket.io).
 *
 * Extrae el JWT de la handshake (`auth.token` o `headers.authorization`)
 * y lo verifica con el mismo secreto que la estrategia HTTP. Si es válido,
 * adjunta el payload a `socket.data.user` para que los gateways lo usen.
 *
 * El handshake ocurre una sola vez al conectar; en eventos posteriores
 * reutilizamos `socket.data.user`.
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();

    if (client.data.user) return true; // ya autenticado en este socket

    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`Socket ${client.id} sin token — rechazado.`);
      return false;
    }
    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.get<string>('jwt.secret'),
      });
      client.data.user = payload;
      return true;
    } catch (err) {
      this.logger.warn(`Token inválido en socket ${client.id}: ${(err as Error).message}`);
      return false;
    }
  }

  private extractToken(client: Socket): string | undefined {
    const authObj = (client.handshake.auth ?? {}) as Record<string, unknown>;
    if (typeof authObj.token === 'string') return authObj.token;

    const header = client.handshake.headers['authorization'];
    if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
      return header.slice(7);
    }
    return undefined;
  }
}
