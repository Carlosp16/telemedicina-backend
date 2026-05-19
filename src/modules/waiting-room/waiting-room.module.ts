import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  WaitingRoomEntry,
  WaitingRoomEntrySchema,
} from '../../schemas/waiting-room.schema';
import { WaitingRoomController } from './waiting-room.controller';
import { WaitingRoomService } from './waiting-room.service';
import { CasesModule } from '../cases/cases.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WaitingRoomEntry.name, schema: WaitingRoomEntrySchema },
    ]),
    // CasesModule importa UsersModule, que ahora importa WaitingRoomModule.
    // forwardRef rompe el ciclo en tiempo de resolución.
    forwardRef(() => CasesModule),
  ],
  controllers: [WaitingRoomController],
  providers: [WaitingRoomService],
  exports: [WaitingRoomService],
})
export class WaitingRoomModule {}
