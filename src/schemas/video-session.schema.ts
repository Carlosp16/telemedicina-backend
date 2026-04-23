import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum VideoSessionStatus {
  /** Creada, esperando que el otro extremo acepte. */
  RINGING = 'ringing',
  /** Ambos extremos conectados, audio/video fluyendo. */
  ACTIVE = 'active',
  /** Finalizada normalmente. */
  ENDED = 'ended',
  /** Rechazada o cancelada antes de conectar. */
  REJECTED = 'rejected',
}

export type VideoSessionDocument = HydratedDocument<VideoSession>;

/**
 * Colección `sesiones_video`.
 *
 * Registra cada sesión de videoconferencia (WebRTC). El backend solamente
 * actúa como señalizador (intercambia SDP + ICE candidates mediante
 * Socket.io); el audio y video viajan P2P entre paciente y médico.
 *
 * Esta colección no almacena media en ningún momento.
 */
@Schema({
  collection: 'sesiones_video',
  timestamps: true,
  toJSON: { virtuals: true, versionKey: false },
})
export class VideoSession {
  @Prop({ type: Types.ObjectId, ref: 'Case', required: true, index: true })
  case: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patient: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  doctor: Types.ObjectId;

  @Prop({ required: true, enum: VideoSessionStatus, default: VideoSessionStatus.RINGING })
  status: VideoSessionStatus;

  /** Marca de inicio (cuando se llama a /start o equivalente). */
  @Prop({ default: () => new Date() })
  startedAt: Date;

  @Prop() endedAt?: Date;

  /** Duración en segundos, calculada al cerrar. */
  @Prop() durationSec?: number;

  /** Lado que finalizó la llamada (útil para UX). */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  endedBy?: Types.ObjectId;
}

export const VideoSessionSchema = SchemaFactory.createForClass(VideoSession);
