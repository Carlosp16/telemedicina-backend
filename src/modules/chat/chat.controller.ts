import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../schemas/user.schema';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

import { ChatService } from './chat.service';
import { StartChatDto } from './dto/start-chat.dto';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly service: ChatService) {}

  @UseGuards(RolesGuard)
  @Roles(UserRole.PACIENTE)
  @Post('start')
  @ApiOperation({ summary: 'El paciente inicia un chat con un médico disponible.' })
  start(@CurrentUser() user: JwtPayload, @Body() dto: StartChatDto) {
    return this.service.startChat(user.sub, dto.reason);
  }

  @Get('cases/:id/messages')
  @ApiOperation({ summary: 'Listar mensajes de un caso (ambos participantes).' })
  messages(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.listMessages(id, user.sub);
  }

  @Post('cases/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Marcar todos los mensajes del caso como leídos.' })
  async read(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.service.markAsRead(id, user.sub);
  }
}
