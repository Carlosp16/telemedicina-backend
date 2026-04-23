import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from '../../schemas/user.schema';
import { AccessCodesModule } from '../access-codes/access-codes.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * Módulo que agrupa la gestión de usuarios (pacientes, médicos, admins).
 * Exporta `UsersService` para que lo consuman `AuthModule`, `WaitingRoomModule`,
 * `ChatModule` y `VideoModule`.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    AccessCodesModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
