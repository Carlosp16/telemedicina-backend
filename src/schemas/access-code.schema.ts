import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AccessCodeDocument = HydratedDocument<AccessCode>;

/**
 * Colección `codigos_acceso`.
 *
 * Cada documento representa un código de invitación que permite a un
 * paciente registrarse en el aplicativo móvil. Reemplaza la extracción
 * automatizada de aseguradoras del TEG original por un flujo controlado
 * por el administrador.
 *
 * Ciclo de vida:
 *   1. El administrador genera el código → `used = false`, `expiresAt` opcional.
 *   2. El paciente lo utiliza en el registro → `used = true`, `usedAt` y `usedBy`.
 *   3. Un código sólo puede usarse una vez.
 */
@Schema({
  collection: 'codigos_acceso',
  timestamps: true,
  toJSON: { virtuals: true, versionKey: false },
})
export class AccessCode {
  @Prop({ required: true, unique: true, index: true, uppercase: true, trim: true })
  code: string;

  @Prop({ default: false })
  used: boolean;

  @Prop() usedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usedBy?: Types.ObjectId;

  /** Fecha opcional de expiración: vencido = !used y ahora > expiresAt */
  @Prop() expiresAt?: Date;

  /** Administrador que lo generó. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  /** Notas libres del administrador (ej. nombre del paciente asignado). */
  @Prop({ trim: true })
  notes?: string;
}

export const AccessCodeSchema = SchemaFactory.createForClass(AccessCode);
