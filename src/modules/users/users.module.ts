import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from '../../schemas/user.schema';
import { AccessCodesModule } from '../access-codes/access-codes.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { WaitingRoomModule } from '../waiting-room/waiting-room.module';

/**
 * Módulo que agrupa la gestión de usuarios (pacientes, médicos, admins).
 * Exporta `UsersService` para que lo consuman `AuthModule`, `WaitingRoomModule`,
 * `ChatModule` y `VideoModule`.
 *
 * Importa `WaitingRoomModule` con forwardRef para evitar el ciclo:
 *   WaitingRoomModule → CasesModule → UsersModule → WaitingRoomModule
 * que se forma porque ahora el setAvailability auto-asigna pacientes en cola.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    AccessCodesModule,
    forwardRef(() => WaitingRoomModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
