import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Payload público (sin autenticación) para `POST /users/register`.
 *
 * La validación de contraseña replica las reglas del TEG:
 *  - Entre 6 y 30 caracteres.
 *  - Acepta letras, números, guión bajo y punto.
 */
export class RegisterPatientDto {
  @ApiProperty({ example: 'ABCD2345', description: 'Código de acceso emitido por el administrador.' })
  @IsString()
  @IsNotEmpty()
  accessCode: string;

  @ApiProperty({ example: 'paciente@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'mi.password_1',
    minLength: 6,
    maxLength: 30,
    description: 'Entre 6 y 30 caracteres. Permite letras, números, "_" y ".".',
  })
  @IsString()
  @Length(6, 30)
  @Matches(/^[A-Za-z0-9_.]+$/, {
    message:
      'La contraseña sólo puede contener letras, números, guión bajo (_) o punto (.).',
  })
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;
}
