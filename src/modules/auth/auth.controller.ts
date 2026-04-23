import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from './strategies/jwt.strategy';
import { UsersService } from '../users/users.service';

/**
 * Endpoints de autenticación.
 *
 * Rutas públicas:
 *  - POST /auth/login
 *  - POST /auth/forgot-password
 *  - POST /auth/reset-password
 *  - GET  /auth/ice-servers      (config WebRTC; estrictamente no es auth)
 *
 * Rutas autenticadas:
 *  - GET  /auth/me
 *  - POST /auth/logout           (logout del cliente; el JWT es stateless,
 *                                 sólo informamos 204 para higiene)
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @ApiOperation({
    summary: 'Inicio de sesión con email + contraseña.',
    description:
      'Devuelve un JWT en `accessToken`. Incluirlo en el header ' +
      '`Authorization: Bearer <token>` en las siguientes llamadas.',
  })
  login(@Body() _dto: LoginDto, @Req() req: { user: any }) {
    // LocalAuthGuard deja el usuario validado en req.user
    return this.auth.login(req.user);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Solicitar un enlace de recuperación de contraseña.',
    description:
      'Siempre responde 204, independientemente de si el email existe, ' +
      'para no revelar cuentas registradas.',
  })
  async forgot(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.auth.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Consumir un token de recuperación y establecer nueva contraseña.',
  })
  async reset(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(dto.token, dto.newPassword);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Perfil del usuario autenticado.' })
  me(@CurrentUser() user: JwtPayload) {
    return this.users.findById(user.sub);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Cierre de sesión del lado cliente.',
    description:
      'Los JWT son stateless, por lo que el servidor sólo responde 204. ' +
      'El cliente debe eliminar el token de su almacenamiento local.',
  })
  logout(): void {
    /* no-op */
  }

  @Get('ice-servers')
  @ApiOperation({
    summary: 'Configuración de STUN/TURN para los clientes WebRTC.',
    description:
      'Devuelve los `iceServers` que el cliente debe pasar a ' +
      '`RTCPeerConnection`. Se expone sin autenticación porque no contiene ' +
      'datos sensibles (en producción se pueden generar credenciales TURN ' +
      'de corta duración).',
  })
  iceServers() {
    const servers: Array<{
      urls: string | string[];
      username?: string;
      credential?: string;
    }> = [{ urls: this.config.get<string>('webrtc.stunUrl')! }];

    const turn = this.config.get<string>('webrtc.turnUrl');
    if (turn) {
      servers.push({
        urls: turn,
        username: this.config.get<string>('webrtc.turnUsername') ?? undefined,
        credential: this.config.get<string>('webrtc.turnCredential') ?? undefined,
      });
    }
    return { iceServers: servers };
  }
}
