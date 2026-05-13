import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Campos editables por el admin sobre un médico. Notas:
 *  - `email` no se permite cambiar para no romper login y referencias.
 *  - Las contraseñas se gestionan por separado (flujo reset).
 */
export class UpdateDoctorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  specialty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  licenseNumber?: string;

  @ApiPropertyOptional({
    description: 'Si false, el médico no puede iniciar sesión ni ser asignado.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
