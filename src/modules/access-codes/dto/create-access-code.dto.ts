import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Payload para `POST /access-codes`. Sólo accesible por administradores.
 */
export class CreateAccessCodeDto {
  @ApiPropertyOptional({
    description:
      'Fecha ISO de expiración del código. Si se omite, el código no expira.',
    example: '2026-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({
    description: 'Notas internas del administrador (ej. paciente asignado).',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;
}
