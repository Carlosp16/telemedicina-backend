import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * Tipos de caso clínico soportados por la plataforma.
 */
export enum CaseType {
  CHAT = 'chat',
  VIDEO = 'video',
}

/**
 * Estado del caso.
 */
export enum CaseStatus {
  /** Aún no atendido, en cola o conectándose. */
  PENDING = 'pending',
  /** Caso en curso (chat o videoconferencia activa). */
  ACTIVE = 'active',
  /** Caso finalizado por el médico. */
  CLOSED = 'closed',
}

export type CaseDocument = HydratedDocument<Case>;

/**
 * Colección `casos`.
 *
 * Representa una consulta/caso clínico entre un paciente y un médico.
 * Sirve como "carpeta" que agrupa los mensajes de chat y las sesiones
 * de video asociadas, permitiendo al médico cerrar el caso cuando
 * finalice la atención.
 */
@Schema({
  collection: 'casos',
  timestamps: true,
  toJSON: { virtuals: true, versionKey: false },
})
export class Case {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patient: Types.ObjectId;

  /** Médico asignado. Puede ser null mientras el caso está en la lista de espera. */
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  doctor?: Types.ObjectId;

  @Prop({ required: true, enum: CaseType, index: true })
  type: CaseType;

  @Prop({ required: true, enum: CaseStatus, default: CaseStatus.PENDING, index: true })
  status: CaseStatus;

  /** Resumen corto del motivo (opcional, lo llena el paciente al iniciar). */
  @Prop({ trim: true, maxlength: 300 })
  reason?: string;

  /** Observaciones del médico al cerrar el caso. */
  @Prop({ trim: true, maxlength: 2000 })
  diagnosis?: string;

  @Prop() closedAt?: Date;
}

export const CaseSchema = SchemaFactory.createForClass(Case);
CaseSchema.index({ patient: 1, status: 1 });
CaseSchema.index({ doctor: 1, status: 1 });
