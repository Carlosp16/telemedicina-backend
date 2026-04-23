import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Servicio de correo transaccional.
 *
 * Abstrae nodemailer y permite intercambiar fácilmente el transporte
 * (SMTP de Mailtrap en desarrollo, SES/SendGrid en producción).
 *
 * En entornos de test, si no hay credenciales configuradas, el transporte
 * se inicializa como `jsonTransport` (no envía nada, sólo loggea).
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter!: Transporter;
  private from!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const host = this.config.get<string>('mail.host');
    const user = this.config.get<string>('mail.user');
    const pass = this.config.get<string>('mail.pass');
    this.from = this.config.get<string>('mail.from')!;

    if (!host || (this.config.get<string>('nodeEnv') === 'test')) {
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
      this.logger.warn('MailService usando jsonTransport (no se enviarán emails reales).');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('mail.port'),
      secure: false,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Recuperación de contraseña — Plataforma de Telemedicina',
      text:
        `Recibimos una solicitud para restablecer tu contraseña.\n\n` +
        `Abre el siguiente enlace (válido por 24 horas) para continuar:\n` +
        `${resetUrl}\n\n` +
        `Si no realizaste esta solicitud, ignora este correo.`,
      html: `
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p><a href="${resetUrl}">Restablecer contraseña</a></p>
        <p>El enlace es válido por 24 horas. Si no realizaste esta solicitud,
        ignora este correo.</p>
      `,
    });
    this.logger.debug(`Correo de reset enviado a ${to} (messageId=${info.messageId}).`);
  }
}
