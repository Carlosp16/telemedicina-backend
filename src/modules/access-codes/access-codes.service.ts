import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';

import {
  AccessCode,
  AccessCodeDocument,
} from '../../schemas/access-code.schema';
import { CreateAccessCodeDto } from './dto/create-access-code.dto';

/**
 * Servicio encargado de la generación y validación de códigos de acceso.
 *
 * Los códigos son la vía por la que un paciente puede registrarse
 * (sustituyen la extracción automatizada de aseguradoras del TEG original).
 */
@Injectable()
export class AccessCodesService {
  constructor(
    @InjectModel(AccessCode.name)
    private readonly model: Model<AccessCodeDocument>,
  ) {}

  /**
   * Genera un nuevo código y lo persiste. Sólo un admin debería invocarlo.
   *
   * El formato es de 8 caracteres alfanuméricos en mayúsculas, evitando
   * caracteres ambiguos (0, O, I, 1) para reducir errores al transcribirlo.
   */
  async create(
    dto: CreateAccessCodeDto,
    adminId: string,
  ): Promise<AccessCodeDocument> {
    const code = this.generateReadableCode(8);

    const doc = await this.model.create({
      code,
      used: false,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      notes: dto.notes,
      createdBy: new Types.ObjectId(adminId),
    });
    return doc;
  }

  /**
   * Valida un código sin consumirlo. Lanza si es inválido o está vencido.
   * Se usa durante el registro de un paciente.
   */
  async assertUsable(code: string): Promise<AccessCodeDocument> {
    const normalized = code.trim().toUpperCase();
    const doc = await this.model.findOne({ code: normalized });

    if (!doc) {
      throw new NotFoundException('Código de acceso no encontrado.');
    }
    if (doc.used) {
      throw new BadRequestException('Este código de acceso ya fue utilizado.');
    }
    if (doc.expiresAt && doc.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Este código de acceso está vencido.');
    }
    return doc;
  }

  /**
   * Marca un código como consumido. Debe llamarse en la misma transacción
   * lógica que la creación del usuario (la maneja `UsersService.register`).
   */
  async consume(codeId: Types.ObjectId, userId: Types.ObjectId): Promise<void> {
    await this.model.updateOne(
      { _id: codeId, used: false },
      { $set: { used: true, usedAt: new Date(), usedBy: userId } },
    );
  }

  /**
   * Lista todos los códigos (para el panel administrativo).
   */
  findAll(): Promise<AccessCodeDocument[]> {
    return this.model.find().sort({ createdAt: -1 }).exec();
  }

  /**
   * Revoca un código no consumido (borrado lógico por simplicidad: se marca
   * como usado sin asignarle usuario).
   */
  async revoke(id: string): Promise<void> {
    const res = await this.model.updateOne(
      { _id: new Types.ObjectId(id), used: false },
      { $set: { used: true, usedAt: new Date() } },
    );
    if (res.matchedCount === 0) {
      throw new NotFoundException('Código inexistente o ya utilizado.');
    }
  }

  /**
   * Genera un código legible evitando caracteres ambiguos.
   * Charset: A-Z (sin I, O) + 2-9.
   */
  private generateReadableCode(length: number): string {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i++) {
      out += charset[bytes[i] % charset.length];
    }
    return out;
  }
}
