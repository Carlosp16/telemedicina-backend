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
 * Payload para que un administrador cree la cuenta de un médico.
 * El TEG indica que los médicos son dados de alta por el admin, no
 * se auto-registran.
 */
export class CreateDoctorDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 6, maxLength: 30 })
  @IsString()
  @Length(6, 30)
  @Matches(/^[A-Za-z0-9_.]+$/)
  password: string;

  @ApiProperty() @IsString() @IsNotEmpty() firstName: string;
  @ApiProperty() @IsString() @IsNotEmpty() lastName: string;

  @ApiPropertyOptional() @IsOptional() @IsString() specialty?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() licenseNumber?: string;
}
