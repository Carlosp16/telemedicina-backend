import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Message, MessageSchema } from '../../schemas/message.schema';
import { CasesModule } from '../cases/cases.module';
import { ChatModule } from '../chat/chat.module';

import { FilesService } from './files.service';
import { FilesController } from './files.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }]),
    CasesModule,
    ChatModule, // para emitir notificación en tiempo real
  ],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
