import { IsOptional, IsString, MaxLength } from 'class-validator';

export class StartChatDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}
