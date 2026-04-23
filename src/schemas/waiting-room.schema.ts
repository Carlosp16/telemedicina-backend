import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WaitingRoomEntryDocument = HydratedDocument<WaitingRoomEntry>;

/**
 * Colección `sala_espera`.
 *
 * Cola FIFO de pacientes que intentaron iniciar una videoconferencia sin
 * médicos disponibles y decidieron esperar. El orden se mantiene por
 * `joinedAt` (el más antiguo se atiende primero).
 *
 * Sólo existe un documento por paciente (índice único en `patient`) para
 * evitar duplicados si se reconectan.
 */
@Schema({
  collection: 'sala_espera',
  timestamps: false,
  toJSON: { virtuals: true, versionKey: false },
})
export class WaitingRoomEntry {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  patient: Types.ObjectId;

  @Prop({ default: () => new Date(), index: true })
  joinedAt: Date;

  /** Motivo corto de la consulta, mostrado al médico. */
  @Prop({ trim: true, maxlength: 300 })
  reason?: string;
}

export const WaitingRoomEntrySchema =
  SchemaFactory.createForClass(WaitingRoomEntry);
