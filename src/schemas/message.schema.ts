import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * Tipo de contenido del mensaje.
 */
export enum MessageKind {
  TEXT = 'text',
  FILE = 'file',
}

export type MessageDocument = HydratedDocument<Message>;

/**
 * Colección `mensajes`.
 *
 * Mensajes individuales dentro de un caso (chat o transferencia de archivo).
 *
 * Restricciones alineadas con el alcance del TEG:
 *  - `content` (texto) limitado a 300 caracteres y valida caracteres
 *    prohibidos en `ChatService` antes de persistirse.
 *  - Los archivos se persisten como Base64 dentro de `fileData`, con
 *    validación de mime y peso máximo (1 MB).
 *  - `readBy` marca qué participantes ya vieron el mensaje (para el
 *    contador de "no leídos").
 */
@Schema({
  collection: 'mensajes',
  timestamps: { createdAt: 'createdAt', updatedAt: false },
  toJSON: { virtuals: true, versionKey: false },
})
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Case', required: true, index: true })
  case: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  sender: Types.ObjectId;

  @Prop({ required: true, enum: MessageKind, default: MessageKind.TEXT })
  kind: MessageKind;

  /** Texto del mensaje (sólo si kind === TEXT). */
  @Prop({ trim: true, maxlength: 300 })
  content?: string;

  /** Nombre original del archivo (sólo si kind === FILE). */
  @Prop() fileName?: string;

  /** MIME type: application/pdf, image/jpeg, image/png. */
  @Prop() mimeType?: string;

  /** Peso en bytes. Debe ser ≤ configuration.files.maxSize. */
  @Prop() fileSize?: number;

  /** Contenido en Base64. Sólo se popula si kind === FILE. */
  @Prop() fileData?: string;

  /** IDs de usuarios que ya leyeron el mensaje. */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  readBy: Types.ObjectId[];

  @Prop() createdAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ case: 1, createdAt: 1 });
