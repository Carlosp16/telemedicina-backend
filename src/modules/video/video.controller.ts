import {
  Body,
  Controller,
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

import { VideoService } from './video.service';
import { StartVideoDto } from './dto/start-video.dto';

/**
 * Controlador HTTP de videoconferencia.
 * La negociación ICE/SDP ocurre por el `VideoGateway` (Socket.io).
 */
@ApiTags('video')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('video')
export class VideoController {
  constructor(private readonly service: VideoService) {}

  @UseGuards(RolesGuard)
  @Roles(UserRole.PACIENTE)
  @Post('start')
  @ApiOperation({
    summary: 'El paciente inicia una videollamada (crea la sesión).',
    description:
      'Busca un médico disponible con menor carga. Si no encuentra, ' +
      'responde 404 y el cliente debe ofrecer la sala de espera.',
  })
  start(@CurrentUser() user: JwtPayload, @Body() dto: StartVideoDto) {
    return this.service.createForPatient(user.sub, dto.reason);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.MEDICO)
  @Post(':id/accept')
  @ApiOperation({ summary: 'El médico acepta la llamada entrante.' })
  accept(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.accept(id, user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.MEDICO)
  @Post(':id/reject')
  @ApiOperation({ summary: 'El médico rechaza la llamada entrante.' })
  reject(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.reject(id, user.sub);
  }

  @Post(':id/end')
  @ApiOperation({ summary: 'Cualquiera de los participantes cuelga.' })
  end(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.end(id, user.sub);
  }
}
