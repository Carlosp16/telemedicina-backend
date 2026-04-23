import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class JoinWaitingRoomDto {
  @ApiPropertyOptional({
    maxLength: 300,
    description: 'Motivo corto de la consulta (visible para el médico).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
