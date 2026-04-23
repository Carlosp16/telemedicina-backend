import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';

import { User, UserSchema } from '../../schemas/user.schema';
import { Token, TokenSchema } from '../../schemas/token.schema';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../../mail/mail.module';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { WsJwtGuard } from './guards/ws-jwt.guard';

/**
 * Módulo de autenticación.
 *
 * Exporta:
 *  - `AuthService`, usado por algunos flujos administrativos.
 *  - `JwtModule`, para que los gateways (ChatGateway, VideoGateway) puedan
 *    verificar JWT en los handshakes de Socket.io.
 *  - `WsJwtGuard`, guard reutilizable para todos los gateways.
 */
@Module({
  imports: [
    PassportModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Token.name, schema: TokenSchema },
    ]),
    UsersModule,
    MailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: config.get<string>('jwt.expiresIn') ?? '1d',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy, WsJwtGuard],
  exports: [AuthService, JwtModule, WsJwtGuard],
})
export class AuthModule {}
