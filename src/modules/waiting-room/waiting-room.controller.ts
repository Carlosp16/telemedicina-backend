import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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

import { WaitingRoomService } from './waiting-room.service';
import { JoinWaitingRoomDto } from './dto/join-waiting-room.dto';

/**
 * Endpoints de la sala de espera.
 *
 *  - Pacientes: unirse, salir, consultar posición.
 *  - Médicos: ver la lista y tomar al siguiente paciente.
 */
@ApiTags('waiting-room')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('waiting-room')
export class WaitingRoomController {
  constructor(private readonly service: WaitingRoomService) {}

  // -------- Paciente -----------------------------------------------------
  @UseGuards(RolesGuard)
  @Roles(UserRole.PACIENTE)
  @Post('join')
  @ApiOperation({ summary: 'Unirse a la sala de espera.' })
  join(@CurrentUser() user: JwtPayload, @Body() dto: JoinWaitingRoomDto) {
    return this.service.join(user.sub, dto.reason);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.PACIENTE)
  @Delete('leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Salir voluntariamente de la sala de espera.' })
  async leave(@CurrentUser() user: JwtPayload) {
    await this.service.leave(user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.PACIENTE)
  @Get('position')
  @ApiOperation({ summary: 'Posición del paciente en la cola.' })
  async position(@CurrentUser() user: JwtPayload) {
    return { position: await this.service.position(user.sub) };
  }

  // -------- Médico -------------------------------------------------------
  @UseGuards(RolesGuard)
  @Roles(UserRole.MEDICO)
  @Get()
  @ApiOperation({ summary: 'Listar pacientes en espera (FIFO).' })
  list() {
    return this.service.list();
  }
}
