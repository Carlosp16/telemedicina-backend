import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Módulo global de correo. Queda disponible sin necesidad de importar
 * en cada módulo que lo consuma.
 */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
