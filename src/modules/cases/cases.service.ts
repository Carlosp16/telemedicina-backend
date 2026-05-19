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

  listForPatient(patientId: string): Promise<CaseDocument[]> {
    return this.model
      .find({ patient: new Types.ObjectId(patientId) })
      .sort({ updatedAt: -1 })
      .populate('doctor', 'email firstName lastName specialty')
      .exec();
  }
}
