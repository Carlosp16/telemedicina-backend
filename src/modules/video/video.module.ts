import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  VideoSession,
  VideoSessionSchema,
} from '../../schemas/video-session.schema';
import { UsersModule } from '../users/users.module';
import { CasesModule } from '../cases/cases.module';
import { AuthModule } from '../auth/auth.module';
import { WaitingRoomModule } from '../waiting-room/waiting-room.module';
import { ChatModule } from '../chat/chat.module';

import { VideoService } from './video.service';
import { VideoController } from './video.controller';
import { VideoGateway } from './video.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VideoSession.name, schema: VideoSessionSchema },
    ]),
    AuthModule, // necesario para que WsJwtGuard resuelva JwtService
    UsersModule,
    CasesModule,
    WaitingRoomModule,
    ChatModule, // para reutilizar ChatGateway y notificar llamadas entrantes
  ],
  controllers: [VideoController],
  providers: [VideoService, VideoGateway],
  exports: [VideoService],
})
export class VideoModule {}
