import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  WaitingRoomEntry,
  WaitingRoomEntryDocument,
} from '../../schemas/waiting-room.schema';

/**
 * Servicio de sala de espera.
 *
 * Cola FIFO que sirve para priorizar los pacientes que no pudieron
 * conectarse de inmediato a un médico. El médico puede:
 *  - consultarla (orden ascendente por `joinedAt`),
 *  - tomar el siguiente paciente,
 *  - el paciente puede abandonarla voluntariamente.
 */
@Injectable()
export class WaitingRoomService {
  constructor(
    @InjectModel(WaitingRoomEntry.name)
    private readonly model: Model<WaitingRoomEntryDocument>,
  ) {}

  /**
   * Agrega un paciente a la lista. Si ya está, lanza 409.
   */
  async join(patientId: string, reason?: string): Promise<WaitingRoomEntryDocument> {
    try {
      return await this.model.create({
        patient: new Types.ObjectId(patientId),
        joinedAt: new Date(),
        reason,
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException('Ya estás en la lista de espera.');
      }
      throw err;
    }
  }

  async leave(patientId: string): Promise<void> {
    const res = await this.model.deleteOne({
      patient: new Types.ObjectId(patientId),
    });
    if (res.deletedCount === 0) {
      throw new NotFoundException('No estabas en la lista de espera.');
    }
  }

  /**
   * Lista todas las entradas, más antiguas primero.
   * Incluye información básica del paciente.
   */
  list(): Promise<WaitingRoomEntryDocument[]> {
    return this.model
      .find()
      .sort({ joinedAt: 1 })
      .populate('patient', 'email firstName lastName')
      .exec();
  }

  /**
   * Devuelve el próximo paciente en la cola y lo remueve en la misma
   * operación atómica (findOneAndDelete con orden ascendente).
   */
  async takeNext(): Promise<WaitingRoomEntryDocument | null> {
    return this.model
      .findOneAndDelete(
        {},
        { sort: { joinedAt: 1 } },
      )
      .populate('patient', 'email firstName lastName')
      .exec();
  }

  async position(patientId: string): Promise<number> {
    const entry = await this.model.findOne({ patient: new Types.ObjectId(patientId) });
    if (!entry) throw new NotFoundException('No estás en la lista de espera.');
    const ahead = await this.model.countDocuments({
      joinedAt: { $lt: entry.joinedAt },
    });
    return ahead + 1; // 1-indexado
  }
}
