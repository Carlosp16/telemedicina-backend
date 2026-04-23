import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument } from 'mongoose';

/**
 * Roles soportados por la plataforma.
 *
 *  - PACIENTE: usuario final del aplicativo móvil.
 *  - MEDICO:   usuario del portal web (BackOffice).
 *  - ADMIN:    usuario con permisos administrativos (gestión de códigos de
 *              acceso, registro de médicos, configuración, etc.).
 */
export enum UserRole {
  PACIENTE = 'paciente',
  MEDICO = 'medico',
  ADMIN = 'admin',
}

export type UserDocument = HydratedDocument<User>;

/**
 * Colección `usuarios`.
 *
 * Representa tanto pacientes como médicos y administradores. La distinción
 * se hace mediante el campo `role`.
 *
 * Reglas de negocio destacadas:
 *  - La contraseña se almacena SIEMPRE como hash bcrypt (nunca en claro).
 *  - `failedLoginAttempts` se incrementa en cada login fallido y la cuenta
 *    se bloquea cuando supera `MAX_LOGIN_ATTEMPTS`.
 *  - `isActive` = false equivale a cuenta bloqueada / inhabilitada.
 *  - Los médicos agregan metadata clínica (especialidad, matrícula).
 *  - `availability` se usa para el ruteo de llamadas y la lista de espera.
 */
@Schema({
  collection: 'usuarios',
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  toJSON: {
    virtuals: true,
    transform: (_, ret) => {
      // Nunca exponer el hash ni campos internos en las respuestas.
      delete (ret as any).password;
      delete (ret as any).__v;
      return ret;
    },
  },
})
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email: string;

  /** Hash bcrypt de la contraseña. NUNCA se devuelve en respuestas de la API. */
  @Prop({ required: true })
  password: string;

  @Prop({ required: true, enum: UserRole, index: true })
  role: UserRole;

  @Prop({ trim: true })
  firstName?: string;

  @Prop({ trim: true })
  lastName?: string;

  /** Sólo para médicos. */
  @Prop({ trim: true })
  specialty?: string;

  /** Número de matrícula profesional. Sólo para médicos. */
  @Prop({ trim: true })
  licenseNumber?: string;

  /**
   * Disponibilidad del médico para atender pacientes.
   *  - Para pacientes este campo se ignora.
   *  - Para médicos controla el ruteo en `WaitingRoomService` y la
   *    creación de nuevos casos de chat/video.
   */
  @Prop({ default: false })
  available: boolean;

  /**
   * Carga actual de trabajo (cantidad de casos abiertos). Se usa para
   * balancear automáticamente a qué médico se le asigna un nuevo caso.
   */
  @Prop({ default: 0, min: 0 })
  activeCases: number;

  /** Intentos fallidos de inicio de sesión consecutivos. */
  @Prop({ default: 0 })
  failedLoginAttempts: number;

  /** Si es false, la cuenta está bloqueada o inhabilitada. */
  @Prop({ default: true })
  isActive: boolean;

  /** Código de acceso usado al registrarse (sólo pacientes). */
  @Prop({ trim: true })
  registrationCode?: string;

  @Prop() createdAt?: Date;
  @Prop() updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Índice compuesto para búsquedas frecuentes de médicos disponibles.
UserSchema.index({ role: 1, available: 1, activeCases: 1 });
