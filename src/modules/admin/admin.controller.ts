import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, User, UserDocument } from '../../schemas/user.schema';
import { Case, CaseDocument, CaseStatus } from '../../schemas/case.schema';
import { WaitingRoomService } from '../waiting-room/waiting-room.service';

/**
 * Endpoints exclusivos del panel de administración.
 */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Case.name) private readonly caseModel: Model<CaseDocument>,
    private readonly waitingRoom: WaitingRoomService,
  ) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Stats globales para el dashboard del admin.',
    description:
      'Devuelve conteos rápidos: pacientes registrados, médicos activos, ' +
      'médicos disponibles ahora, pacientes en sala de espera, casos activos.',
  })
  async stats() {
    const [
      totalPatients,
      activePatients,
      totalDoctors,
      activeDoctors,
      doctorsAvailableNow,
      waitingCount,
      activeCases,
    ] = await Promise.all([
      this.userModel.countDocuments({ role: UserRole.PACIENTE }),
      this.userModel.countDocuments({ role: UserRole.PACIENTE, isActive: true }),
      this.userModel.countDocuments({ role: UserRole.MEDICO }),
      this.userModel.countDocuments({ role: UserRole.MEDICO, isActive: true }),
      this.userModel.countDocuments({
        role: UserRole.MEDICO,
        isActive: true,
        available: true,
      }),
      this.waitingRoom.count(),
      this.caseModel.countDocuments({ status: CaseStatus.ACTIVE }),
    ]);
    return {
      patients: { total: totalPatients, active: activePatients },
      doctors: {
        total: totalDoctors,
        active: activeDoctors,
        availableNow: doctorsAvailableNow,
      },
      waitingRoom: waitingCount,
      activeCases,
    };
  }
}
