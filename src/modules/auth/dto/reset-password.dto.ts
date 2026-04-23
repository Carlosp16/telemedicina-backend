import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Token emitido por el endpoint de recuperación (24h de validez).',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ minLength: 6, maxLength: 30 })
  @IsString()
  @Length(6, 30)
  @Matches(/^[A-Za-z0-9_.]+$/)
  newPassword: string;
}
