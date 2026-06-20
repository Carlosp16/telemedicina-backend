import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Case,
  CaseDocument,
  CaseStatus,
  CaseType,
} from '../../schemas/case.schema';
import { UsersService } from '../users/users.service';

/**
 * Servicio transversal para casos clínicos.
 *
 * Lo usan `ChatService` y `VideoService` para crear y cerrar casos.
 * También incrementa/decrementa la carga (`activeCases`) del médico
 * para el balanceo.
 */
@Injectable()
export class CasesService {
  constructor(
    @InjectModel(Case.name) private readonly model: Model<CaseDocument>,
    @Inject(forwardRef(() => UsersService))
    private readonly users: UsersService,
  ) {}

  async create(
    patient: Types.ObjectId,
    doctor: Types.ObjectId,
    type: CaseType,
    reason?: string,
  ): Promise<CaseDocument> {
    const c = await this.model.create({
      patient,
      doctor,
      type,
      status: CaseStatus.ACTIVE,
      reason,
    });
    await this.users.incrementActiveCases(doctor, 1);
    return c;
  }

  async close(caseId: string, closedBy: Types.ObjectId, diagnosis?: string): Promise<CaseDocument> {
    const c = await this.model.findById(caseId);
    if (!c) throw new NotFoundException('Caso no encontrado.');
    if (c.status === CaseStatus.CLOSED) return c;

    c.status = CaseStatus.CLOSED;
    c.closedAt = new Date();
    if (diagnosis) c.diagnosis = diagnosis;
    await c.save();

    if (c.doctor) {
      await this.users.incrementActiveCases(c.doctor as Types.ObjectId, -1);
    }
    return c;
  }

  findById(id: string): Promise<CaseDocument | null> {
    return this.model
      .findById(id)
      .populate('patient', 'email firstName lastName')
      .populate('doctor', 'email firstName lastName specialty')
      .exec();
  }

  listForDoctor(doctorId: string): Promise<CaseDocument[]> {
    return this.model
      .find({ doctor: new Types.ObjectId(doctorId), status: { $ne: CaseStatus.CLOSED } })
      .sort({ updatedAt: -1 })
      .populate('patient', 'email firstName lastName')
      .exec();
  }

  /**
   * Casos del paciente que NO están cerrados. Es lo que la app móvil
   * usa para decidir si el paciente está en una consulta activa.
   * Antes devolvía también los cerrados, lo que provocaba que la app
   * lo metiera en chats fantasmas de consultas viejas.
   */
  listForPatient(patientId: string): Promise<CaseDocument[]> {
    return this.model
      .find({
        patient: new Types.ObjectId(patientId),
        status: { $ne: CaseStatus.CLOSED },
      })
      .sort({ updatedAt: -1 })
      .populate('doctor', 'email firstName lastName specialty')
      .exec();
  }

  /**
   * Cierra todos los casos ACTIVE de un médico (por ejemplo, cuando
   * se pone no-disponible o cierra sesión). Devuelve cuántos cerró.
   * Decrementa la carga (`activeCases`) del médico en consecuencia.
   */
  async closeAllForDoctor(
    doctorId: Types.ObjectId,
    reason = 'Médico desconectado',
  ): Promise<number> {
    const open = await this.model
      .find({ doctor: doctorId, status: { $ne: CaseStatus.CLOSED } })
      .exec();
    if (open.length === 0) return 0;
    const now = new Date();
    await this.model.updateMany(
      { _id: { $in: open.map((c) => c._id) } },
      { $set: { status: CaseStatus.CLOSED, closedAt: now, diagnosis: reason } },
    );
    // Recalculamos la carga real del médico a 0 (cerramos todos los suyos)
    // en vez de iterar con $inc para evitar quedar en negativo si había
    // desincronización previa.
    await this.users.resetActiveCases(doctorId).catch(() => undefined);
    return open.length;
  }
}
