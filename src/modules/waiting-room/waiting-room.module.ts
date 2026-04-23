import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  WaitingRoomEntry,
  WaitingRoomEntrySchema,
} from '../../schemas/waiting-room.schema';
import { WaitingRoomController } from './waiting-room.controller';
import { WaitingRoomService } from './waiting-room.service';

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
