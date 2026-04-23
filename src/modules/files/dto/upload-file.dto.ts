import {
  IsBase64,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Payload para enviar un archivo dentro de un caso.
 *
 * El archivo se envía codificado en Base64 (según el alcance del TEG).
 * El backend valida:
 *  - `mimeType` ∈ {application/pdf, image/jpeg, image/png}
 *  - `size` ≤ MAX_FILE_SIZE (1 MB por defecto)
 *  - `data` efectivamente Base64 y, una vez decodificado, pesa `size` bytes.
 */
export class UploadFileDto {
  @ApiProperty({ example: 'radiografia.jpg' })
  @IsString() @IsNotEmpty() fileName: string;

  @ApiProperty({
    example: 'image/jpeg',
    enum: ['application/pdf', 'image/jpeg', 'image/png'],
  })
  @IsIn(['application/pdf', 'image/jpeg', 'image/png'])
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';

  @ApiProperty({ description: 'Peso declarado en bytes (verificado por el servidor).' })
  @IsInt() @Min(1) @Max(1048576 /* 1 MB */)
  size: number;

  @ApiProperty({ description: 'Contenido en Base64 (sin prefijo data:).' })
  @IsBase64()
  data: string;
}
