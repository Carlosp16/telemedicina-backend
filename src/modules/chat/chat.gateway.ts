import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger, UseGuards, ValidationPipe, UsePipes } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

/**
 * Gateway de chat en tiempo real (namespace `/chat`).
 *
 * Eventos (cliente → servidor):
 *  - `join-case`    { caseId }                → se une al room del caso.
 *  - `leave-case`   { caseId }
 *  - `send-message` { caseId, content }       → persiste y emite a todos.
 *  - `typing`       { caseId, typing: bool }  → broadcast efímero.
 *
 * Eventos (servidor → cliente):
 *  - `message`      { ...mensaje persistido }
 *  - `typing`       { userId, typing }
 *  - `case-closed`  { caseId }                → emitido al cerrar el caso.
 */
@UseGuards(WsJwtGuard)
@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: true, credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly chat: ChatService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * En NestJS, `@UseGuards` solo corre para `@SubscribeMessage` handlers, no
   * para `handleConnection`. Por eso autenticamos manualmente acá: leemos el
   * token del handshake (auth.token o Authorization), lo validamos y lo
   * adjuntamos a `client.data.user` para que el resto del gateway lo use.
   */
  async handleConnection(client: Socket): Promise<void> {
    this.logger.log(`Chat: handshake recibido socket=${client.id}`);
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`Chat ${client.id} sin token — rechazado.`);
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.get<string>('jwt.secret'),
      });
      client.data.user = payload;
      this.logger.log(`Chat conectado: ${payload.email} (socket=${client.id}).`);
    } catch (err) {
      this.logger.warn(
        `Token inválido en chat ${client.id}: ${(err as Error).message}`,
      );
      client.disconnect(true);
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

  handleDisconnect(client: Socket): void {
    const user = client.data.user as JwtPayload | undefined;
    if (user) this.logger.debug(`Chat desconectado: ${user.email}.`);
  }

  // -------------------------------------------------------------------------
  // Gestión de rooms por caso
  // -------------------------------------------------------------------------

  @SubscribeMessage('join-case')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { caseId: string },
  ) {
    const user = client.data.user as JwtPayload;
    try {
      // assertParticipant implícito al listar mensajes — lanza si no participa.
      await this.chat.listMessages(data.caseId, user.sub);
    } catch (err) {
      throw new WsException((err as Error).message);
    }
    await client.join(this.room(data.caseId));
    return { ok: true };
  }

  @SubscribeMessage('leave-case')
  onLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { caseId: string },
  ) {
    client.leave(this.room(data.caseId));
  }

  // -------------------------------------------------------------------------
  // Envío de mensajes
  // -------------------------------------------------------------------------

  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  @SubscribeMessage('send-message')
  async onSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { caseId: string } & SendMessageDto,
  ) {
    const user = client.data.user as JwtPayload;
    const msg = await this.chat.postTextMessage(data.caseId, user.sub, data.content);
    const payload = msg.toJSON();

    // Emitimos a todos los sockets conectados al caso. Excluimos al emisor
    // (que ya recibe el mensaje en el `ack` de retorno) para evitar duplicados
    // y para no depender del room (si el remitente todavía no se unió por
    // race condition, igual ve su mensaje vía el ack).
    client.to(this.room(data.caseId)).emit('message', payload);

    // El ack incluye el mensaje completo: el cliente puede agregarlo a la UI
    // sin esperar el broadcast.
    return { ok: true, message: payload };
  }

  @SubscribeMessage('typing')
  onTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { caseId: string; typing: boolean },
  ) {
    const user = client.data.user as JwtPayload;
    client.to(this.room(data.caseId)).emit('typing', {
      userId: user.sub,
      typing: Boolean(data.typing),
    });
  }

  /**
   * Helper público: permite a otros servicios (ej. `CasesService` al cerrar)
   * notificar a las salas de chat.
   */
  emitCaseClosed(caseId: string): void {
    this.server.of('/chat').to(this.room(caseId)).emit('case-closed', { caseId });
  }

  /**
   * Helper público: permite emitir mensajes desde fuera (ej. cuando se envía
   * un archivo vía el endpoint HTTP y queremos notificar al otro peer).
   */
  emitMessage(caseId: string, message: unknown): void {
    this.server.of('/chat').to(this.room(caseId)).emit('message', message);
  }

  /**
   * Helper público para que VideoService notifique a los participantes del
   * chat que hay una llamada entrante.
   */
  emitIncomingCall(caseId: string, payload: {
    sessionId: string;
    callerId: string;
    callerName?: string;
  }): void {
    this.server.of('/chat').to(this.room(caseId)).emit('incoming-call', payload);
  }

  private room(caseId: string): string {
    return `chat:${caseId}`;
  }
}
