import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * Tipos de token auxiliares que persistimos en base de datos.
 * Los JWT de sesión NO se persisten (son stateless); aquí sólo guardamos
 * tokens que deben invalidarse o rastrearse (reset de contraseña, etc.).
 */
export enum TokenType {
  PASSWORD_RESET = 'password_reset',
  /** Lista negra de JWT de sesión que fueron revocados por logout manual. */
  JWT_BLACKLIST = 'jwt_blacklist',
}

export type TokenDocument = HydratedDocument<Token>;

/**
 * Colección `tokens`.
 *
 * Mongo elimina automáticamente los documentos al vencer `expiresAt`
 * gracias al índice TTL configurado al final.
 */
@Schema({
  collection: 'tokens',
  timestamps: { createdAt: 'createdAt', updatedAt: false },
  toJSON: { virtuals: true, versionKey: false },
})
export class Token {
  /** Valor del token (o su hash). Para reset guardamos el hash, no el crudo. */
  @Prop({ required: true, index: true })
  value: string;

  @Prop({ required: true, enum: TokenType, index: true })
  type: TokenType;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop() usedAt?: Date;

  /** Fecha de expiración absoluta. Aprovechada por el índice TTL. */
  @Prop({ required: true })
  expiresAt: Date;

  @Prop() createdAt?: Date;
}

export const TokenSchema = SchemaFactory.createForClass(Token);

// Índice TTL: Mongo borra el documento una vez que expiresAt < ahora.
TokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
