import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from '../../schemas/user.schema';
import { AccessCodesModule } from '../access-codes/access-codes.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { WaitingRoomModule } from '../waiting-room/waiting-room.module';
import { CasesModule } from '../cases/cases.module';

/**
 * Módulo que agrupa la gestión de usuarios (pacientes, médicos, admins).
 *
 * Dependencias:
 *  - WaitingRoomModule: directo (WaitingRoom es standalone, no hay ciclo).
 *  - CasesModule: forwardRef, porque CasesService usa UsersService
 *    (incrementActiveCases) → ciclo 2-vías Users ↔ Cases, robusto con forwardRef.
 *
 * UsersController orquesta el auto-asignamiento al ponerse disponible un médico
 * (takeNext de la cola + create del caso).
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    AccessCodesModule,
    WaitingRoomModule,
    forwardRef(() => CasesModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
