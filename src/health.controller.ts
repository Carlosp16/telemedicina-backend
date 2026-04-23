import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * Endpoint de salud del servicio.
 *
 * Útil para probes de Kubernetes / monitoreo. No requiere autenticación
 * y queda fuera del prefijo global (`setGlobalPrefix('api', { exclude: ['health'] })`).
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly mongo: Connection) {}

  @Get()
  @ApiOperation({ summary: 'Estado del servicio y conexión a la BD.' })
  check() {
    const dbState = this.mongo.readyState; // 0 disconnected, 1 connected, 2 connecting, 3 disconnecting
    return {
      status: 'ok',
      uptime: process.uptime(),
      mongo: ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] ?? 'unknown',
      timestamp: new Date().toISOString(),
    };
  }
}
