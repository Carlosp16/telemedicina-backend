import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../schemas/user.schema';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

import { UsersService } from './users.service';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

class ToggleAvailabilityDto {
  @IsBoolean()
  available!: boolean;
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  // -------- Público -----------------------------------------------------
  @Post('register')
  @ApiOperation({
    summary: 'Registro de paciente.',
    description:
      'Consume un código de acceso válido y crea una cuenta de paciente. ' +
      'No requiere autenticación.',
  })
  register(@Body() dto: RegisterPatientDto) {
    return this.service.registerPatient(dto);
  }

  // -------- Autenticado -------------------------------------------------
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Datos de la cuenta autenticada.' })
  async me(@CurrentUser() user: JwtPayload) {
    return this.service.findById(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('me')
  @ApiOperation({ summary: 'Modificar los datos de la propia cuenta.' })
  update(@CurrentUser() user: JwtPayload, @Body() dto: UpdateAccountDto) {
    return this.service.updateOwnAccount(user.sub, dto);
  }

  // -------- Médico ------------------------------------------------------
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.MEDICO)
  @Patch('me/availability')
  @ApiOperation({
    summary: 'Marca al médico como disponible (o no) para atender consultas.',
  })
  async setAvailability(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ToggleAvailabilityDto,
  ) {
    await this.service.setAvailability(user.sub, dto.available);
    return { available: dto.available };
  }

  // -------- Admin -------------------------------------------------------
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('doctors')
  @ApiOperation({ summary: 'Crear cuenta de médico (sólo admin).' })
  createDoctor(@Body() dto: CreateDoctorDto) {
    return this.service.createDoctor(dto);
  }
}
