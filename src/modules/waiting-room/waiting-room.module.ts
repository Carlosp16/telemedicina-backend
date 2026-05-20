import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  WaitingRoomEntry,
  WaitingRoomEntrySchema,
} from '../../schemas/waiting-room.schema';
import { WaitingRoomController } from './waiting-room.controller';
import { WaitingRoomService } from './waiting-room.service';

/**
 * Módulo de sala de espera. Es standalone: solo gestiona la cola.
 * La orquestación "tomar al siguiente + crear caso" la hace UsersController
 * (que tiene acceso tanto a WaitingRoomService como a CasesService), así
 * evitamos el ciclo WaitingRoom → Cases → Users → WaitingRoom.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WaitingRoomEntry.name, schema: WaitingRoomEntrySchema },
    ]),
  ],
  controllers: [WaitingRoomController],
  providers: [WaitingRoomService],
  exports: [WaitingRoomService],
})
export class WaitingRoomModule {}
