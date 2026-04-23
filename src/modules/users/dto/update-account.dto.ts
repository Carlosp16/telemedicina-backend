import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Payload para que el propio usuario modifique sus datos de cuenta.
 *
 * `currentPassword` es obligatorio si se quiere cambiar `password` o `email`
 * (regla de seguridad del TEG: "previa confirmación de la contraseña actual").
 */
export class UpdateAccountDto {
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;

  @ApiPropertyOptional({ minLength: 6, maxLength: 30 })
  @IsOptional()
  @IsString()
  @Length(6, 30)
  @Matches(/^[A-Za-z0-9_.]+$/)
  password?: string;

  @ApiPropertyOptional({
    description:
      'Contraseña actual. Obligatoria si se modifica email o password.',
  })
  @IsOptional()
  @IsString()
  currentPassword?: string;
}
