import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../schemas/user.schema';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { idOf } from '../../common/utils/refs';

import { CasesService } from './cases.service';

class CloseCaseDto {
  @IsOptional() @IsString() @MaxLength(2000) diagnosis?: string;
}

@ApiTags('cases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cases')
export class CasesController {
  constructor(private readonly service: CasesService) {}

  @Get('mine')
  @ApiOperation({ summary: 'Listar casos del usuario autenticado.' })
  mine(@CurrentUser() user: JwtPayload) {
    return user.role === UserRole.MEDICO
      ? this.service.listForDoctor(user.sub)
      : this.service.listForPatient(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un caso por ID.' })
  byId(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id/close')
  @ApiOperation({
    summary: 'Cerrar un caso (cualquier participante: médico o paciente).',
    description:
      'El médico puede cerrar con un diagnóstico. El paciente también puede ' +
      'cerrar para salir voluntariamente; en ese caso `diagnosis` queda como ' +
      'el motivo declarado o por defecto "Cerrado por el paciente".',
  })
  async close(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CloseCaseDto,
  ) {
    const kase = await this.service.findById(id);
    if (!kase) throw new NotFoundException('Caso no encontrado.');
    const isParticipant =
      idOf(kase.patient) === user.sub || idOf(kase.doctor) === user.sub;
    if (!isParticipant) {
      throw new ForbiddenException('No participas en este caso.');
    }
    const diagnosis =
      dto.diagnosis ||
      (user.role === UserRole.PACIENTE ? 'Cerrado por el paciente' : undefined);
    return this.service.close(id, new Types.ObjectId(user.sub), diagnosis);
  }
}
