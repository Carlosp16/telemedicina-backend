import { IsOptional, IsString, MaxLength } from 'class-validator';

export class StartVideoDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}
