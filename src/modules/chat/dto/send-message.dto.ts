import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

/**
 * Reglas de mensajes de chat (TEG):
 *  - Longitud máxima 300 caracteres.
 *  - No se permiten los caracteres: < > { } [ ] \ / |
 *  - No se permiten mensajes vacíos o con sólo espacios en blanco.
 */
export class SendMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'El mensaje no puede estar vacío.' })
  @Length(1, 300)
  @Matches(/^(?!\s*$).+/, { message: 'El mensaje no puede contener sólo espacios.' })
  @Matches(/^[^<>{}\[\]\\\/|]+$/, {
    message: 'El mensaje contiene caracteres no permitidos (<>{}[]\\/|).',
  })
  content: string;
}
