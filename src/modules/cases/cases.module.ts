import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Case, CaseSchema } from '../../schemas/case.schema';
import { UsersModule } from '../users/users.module';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Case.name, schema: CaseSchema }]),
    // UsersModule -> WaitingRoomModule -> CasesModule (ciclo). forwardRef.
    forwardRef(() => UsersModule),
  ],
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService],
})
export class CasesModule {}
