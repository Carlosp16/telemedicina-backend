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

  @Post('cases/:caseId/start')
  @ApiOperation({
    summary: 'Inicia una videollamada sobre un caso existente.',
    description:
      'Cualquiera de los participantes (paciente o médico) puede dispararla. ' +
      'No crea un caso nuevo, reutiliza el del chat.',
  })
  startForCase(
    @Param('caseId') caseId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createForExistingCase(caseId, user.sub);
  }

  @Post(':id/accept')
  @ApiOperation({
    summary: 'Cualquiera de los participantes acepta la llamada entrante.',
    description:
      'Antes solo lo podía hacer el médico (cuando el flujo era ' +
      'paciente → médico). Ahora cualquiera de los dos puede iniciar y ' +
      'aceptar, así que la validación de participación se hace en el servicio.',
  })
  accept(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.accept(id, user.sub);
  }

  @Post(':id/reject')
  @ApiOperation({
    summary: 'Cualquiera de los participantes rechaza la llamada entrante.',
  })
  reject(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.reject(id, user.sub);
  }

  @Post(':id/end')
  @ApiOperation({ summary: 'Cualquiera de los participantes cuelga.' })
  end(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.end(id, user.sub);
  }
}
