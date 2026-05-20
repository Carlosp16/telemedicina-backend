import { Module, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import configuration from './config/configuration';
import { HealthController } from './health.controller';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AccessCodesModule } from './modules/access-codes/access-codes.module';
import { WaitingRoomModule } from './modules/waiting-room/waiting-room.module';
import { CasesModule } from './modules/cases/cases.module';
import { ChatModule } from './modules/chat/chat.module';
import { VideoModule } from './modules/video/video.module';
import { FilesModule } from './modules/files/files.module';
import { AdminModule } from './modules/admin/admin.module';
import { MailModule } from './mail/mail.module';
import { UsersService } from './modules/users/users.service';

/**
 * Módulo raíz.
 *
 * Carga la configuración, establece la conexión a MongoDB, registra todos
 * los módulos de dominio, y levanta un rate limiter global como último
 * escudo contra abuso (se puede afinar por ruta).
 *
 * En `onApplicationBootstrap` crea el usuario administrador inicial si
 * las variables SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD están presentes.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongo.uri'),
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),

    // Dominios
    MailModule,
    UsersModule,
    AccessCodesModule,
    AuthModule,
    CasesModule,
    WaitingRoomModule,
    ChatModule,
    VideoModule,
    FilesModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppModule.name);

  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.config.get<string>('seed.adminEmail');
    const password = this.config.get<string>('seed.adminPassword');
    if (email && password) {
      await this.users.createAdminIfNotExists(email, password);
      this.logger.log(`Seed admin verificado (${email}).`);
    }
  }
}
