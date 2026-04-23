import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../schemas/user.schema';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

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

  @UseGuards(RolesGuard)
  @Roles(UserRole.MEDICO)
  @Patch(':id/close')
  @ApiOperation({ summary: 'Cerrar un caso (sólo médicos).' })
  close(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CloseCaseDto,
  ) {
    return this.service.close(id, new Types.ObjectId(user.sub), dto.diagnosis);
  }
}
