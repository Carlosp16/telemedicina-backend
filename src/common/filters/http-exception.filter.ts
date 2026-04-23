import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Filtro global de excepciones.
 *
 * Normaliza todas las respuestas de error a la forma:
 *   {
 *     statusCode: number,
 *     timestamp:  string (ISO),
 *     path:       string,
 *     method:     string,
 *     message:    string | string[],
 *     error?:     string
 *   }
 *
 * Los errores inesperados (no-HttpException) se registran con stack completo
 * pero se devuelven al cliente como 500 "Internal server error" sin filtrar
 * detalles de implementación.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else if (typeof payload === 'object' && payload !== null) {
        const p = payload as Record<string, unknown>;
        message = (p.message as string | string[]) ?? exception.message;
        error = p.error as string | undefined;
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error,
    });
  }
}
