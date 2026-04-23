import {
  Body,
  Controller,
  Delete,
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

import { AccessCodesService } from './access-codes.service';
import { CreateAccessCodeDto } from './dto/create-access-code.dto';

/**
 * Endpoints de administración de códigos de acceso.
 * Todos requieren rol ADMIN.
 *
 * Los códigos son consumidos por `UsersService.register()` durante el
 * registro de un paciente; no hay endpoint público para consumirlos.
 */
@ApiTags('access-codes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('access-codes')
export class AccessCodesController {
  constructor(private readonly service: AccessCodesService) {}

  @Post()
  @ApiOperation({ summary: 'Generar un nuevo código de acceso.' })
  create(
    @Body() dto: CreateAccessCodeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los códigos de acceso.' })
  list() {
    return this.service.findAll();
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revocar un código no utilizado.' })
  async revoke(@Param('id') id: string) {
    await this.service.revoke(id);
  }
}
