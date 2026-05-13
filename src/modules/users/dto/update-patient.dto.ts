import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Campos editables por el admin sobre un paciente.
 * En general el admin no edita datos personales de los pacientes (eso lo
 * hacen ellos mismos por la app), pero sí puede activarlos / desactivarlos.
 */
export class UpdatePatientDto {
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

  @ApiPropertyOptional({
    description: 'Si false, el paciente no puede iniciar sesión.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
