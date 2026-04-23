import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccessCode, AccessCodeSchema } from '../../schemas/access-code.schema';
import { AccessCodesController } from './access-codes.controller';
import { AccessCodesService } from './access-codes.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AccessCode.name, schema: AccessCodeSchema },
    ]),
  ],
  controllers: [AccessCodesController],
  providers: [AccessCodesService],
  // Exportado porque `UsersService` lo consume durante el registro.
  exports: [AccessCodesService],
})
export class AccessCodesModule {}
