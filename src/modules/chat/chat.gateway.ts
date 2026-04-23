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

  constructor(private readonly chat: ChatService) {}

  async handleConnection(client: Socket): Promise<void> {
    const user = client.data.user as JwtPayload | undefined;
    if (!user) {
      client.disconnect(true);
      return;
    }
    this.logger.debug(`Chat conectado: ${user.email} (socket=${client.id}).`);
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

    // Emitimos a todos los sockets conectados al caso (incluido el emisor
    // para confirmación — el cliente decide si lo ignora).
    this.server.of('/chat').to(this.room(data.caseId)).emit('message', msg.toJSON());
    return { ok: true, id: String(msg._id) };
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

  private room(caseId: string): string {
    return `chat:${caseId}`;
  }
}
