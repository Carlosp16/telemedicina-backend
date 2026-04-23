import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { VideoService } from './video.service';

/**
 * Gateway de señalización WebRTC (namespace `/video`).
 *
 * IMPORTANTE: este gateway SOLO transporta señales entre los peers
 * (SDP offer/answer + ICE candidates). El audio/video viaja P2P entre
 * los clientes mediante WebRTC; el backend no procesa media.
 *
 * Protocolo de eventos (cliente → servidor):
 *  - `join-session` { sessionId }                → une el socket al room de la sesión.
 *  - `offer`        { sessionId, sdp }           → reenvía a los demás del room.
 *  - `answer`       { sessionId, sdp }           → reenvía a los demás.
 *  - `ice-candidate`{ sessionId, candidate }     → reenvía.
 *  - `hangup`       { sessionId }                → notifica al otro peer.
 *
 * Eventos (servidor → cliente):
 *  - `peer-joined`  { userId }
 *  - `offer`        { sdp, from }
 *  - `answer`       { sdp, from }
 *  - `ice-candidate`{ candidate, from }
 *  - `peer-left`    { userId }
 *  - `hangup`       { from }
 *
 * Flujo típico:
 *   paciente POST /video/start   → obtiene sessionId
 *   ambos    emit 'join-session' → se suman al room
 *   paciente emit 'offer'        → el médico recibe
 *   médico   emit 'answer'
 *   ambos    intercambian 'ice-candidate' varias veces
 *   hasta establecer la conexión P2P. A partir de ahí el media va P2P.
 */
@UseGuards(WsJwtGuard)
@WebSocketGateway({
  namespace: '/video',
  cors: { origin: true, credentials: true },
})
export class VideoGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(VideoGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly videoService: VideoService) {}

  async handleConnection(client: Socket): Promise<void> {
    const user = client.data.user as JwtPayload | undefined;
    if (!user) {
      client.disconnect(true);
      return;
    }
    this.logger.debug(`Video conectado: ${user.email} (socket=${client.id}).`);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const user = client.data.user as JwtPayload | undefined;
    if (!user) return;

    // Notificamos a todas las rooms a las que pertenecía que este peer se fue.
    for (const room of client.rooms) {
      if (room === client.id) continue;
      client.to(room).emit('peer-left', { userId: user.sub });
    }
    this.logger.debug(`Video desconectado: ${user.email}.`);
  }

  // -------------------------------------------------------------------------
  // Eventos de señalización
  // -------------------------------------------------------------------------

  @SubscribeMessage('join-session')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const user = client.data.user as JwtPayload;
    const session = await this.videoService.findById(data.sessionId);
    if (!session) {
      client.emit('error', { message: 'Sesión inexistente.' });
      return;
    }
    const isParticipant =
      String(session.patient) === user.sub || String(session.doctor) === user.sub;
    if (!isParticipant) {
      client.emit('error', { message: 'No participas en esta sesión.' });
      return;
    }

    const room = this.roomName(data.sessionId);
    await client.join(room);
    client.to(room).emit('peer-joined', { userId: user.sub });
    return { ok: true, room };
  }

  @SubscribeMessage('offer')
  onOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; sdp: unknown },
  ) {
    const user = client.data.user as JwtPayload;
    client.to(this.roomName(data.sessionId)).emit('offer', {
      from: user.sub,
      sdp: data.sdp,
    });
  }

  @SubscribeMessage('answer')
  onAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; sdp: unknown },
  ) {
    const user = client.data.user as JwtPayload;
    client.to(this.roomName(data.sessionId)).emit('answer', {
      from: user.sub,
      sdp: data.sdp,
    });
  }

  @SubscribeMessage('ice-candidate')
  onIce(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; candidate: unknown },
  ) {
    const user = client.data.user as JwtPayload;
    client.to(this.roomName(data.sessionId)).emit('ice-candidate', {
      from: user.sub,
      candidate: data.candidate,
    });
  }

  @SubscribeMessage('hangup')
  async onHangup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const user = client.data.user as JwtPayload;
    client.to(this.roomName(data.sessionId)).emit('hangup', { from: user.sub });
    await this.videoService.end(data.sessionId, user.sub).catch(() => undefined);
    client.leave(this.roomName(data.sessionId));
  }

  private roomName(sessionId: string): string {
    return `video:${sessionId}`;
  }
}
