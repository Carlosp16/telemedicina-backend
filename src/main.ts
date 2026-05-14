import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/**
 * Punto de entrada de la aplicación.
 *
 * Responsabilidades:
 *  - Instanciar la aplicación NestJS con AppModule como raíz.
 *  - Activar seguridad básica (helmet, CORS).
 *  - Configurar validación global de DTOs (class-validator).
 *  - Registrar filtros globales de excepciones.
 *  - Servir documentación Swagger en /api/docs.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const config = app.get(ConfigService);

  // --- Seguridad HTTP básica ------------------------------------------------
  app.use(helmet());

  // --- Body size limit ------------------------------------------------------
  // El default de Express (100 KB) corta los uploads de archivos en Base64.
  // Subimos a 2 MB: cubre el tope de 1 MB binario × 1.37 de overhead de Base64
  // + algunos bytes para el resto del JSON.
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ limit: '2mb', extended: true }));

  // --- CORS ----------------------------------------------------------------
  const origins = config.get<string[]>('corsOrigins') ?? ['*'];
  app.enableCors({
    origin: origins.includes('*') ? true : origins,
    credentials: true,
  });

  // --- Prefijo global ------------------------------------------------------
  app.setGlobalPrefix('api', { exclude: ['health'] });

  // --- Validación global de DTOs -------------------------------------------
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,               // descarta propiedades no declaradas
      forbidNonWhitelisted: true,    // error si llega una propiedad extra
      transform: true,               // aplica transformaciones (@Type)
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // --- Filtros globales ----------------------------------------------------
  app.useGlobalFilters(new HttpExceptionFilter());

  // --- Swagger / OpenAPI ---------------------------------------------------
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Plataforma Telemedicina — API')
    .setDescription(
      'API REST y WebSockets de la plataforma de comunicación multimedia ' +
        'en tiempo real entre pacientes y profesionales de la salud.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
  Logger.log(`🏥  Plataforma Telemedicina escuchando en http://localhost:${port}`, 'Bootstrap');
  Logger.log(`📚  Documentación Swagger en http://localhost:${port}/api/docs`, 'Bootstrap');
}

bootstrap();
