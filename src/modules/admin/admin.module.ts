import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from '../../schemas/user.schema';
import { Case, CaseSchema } from '../../schemas/case.schema';
import { AuthModule } from '../auth/auth.module';
import { WaitingRoomModule } from '../waiting-room/waiting-room.module';

import { AdminController } from './admin.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Case.name, schema: CaseSchema },
    ]),
    AuthModule, // necesario para JwtAuthGuard
    WaitingRoomModule,
  ],
  controllers: [AdminController],
})
export class AdminModule {}
