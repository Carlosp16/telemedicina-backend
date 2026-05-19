import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  WaitingRoomEntry,
  WaitingRoomEntryDocument,
} from '../../schemas/waiting-room.schema';
import { CasesService } from '../cases/cases.service';
import { CaseType, CaseDocument } from '../../schemas/case.schema';
import { idOf } from '../../common/utils/refs';

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
    @Inject(forwardRef(() => CasesService))
    private readonly cases: CasesService,
  ) {}

  /**
   * Despacha al primer paciente de la cola al médico indicado.
   * Crea un caso CHAT entre ambos, lo saca de la cola atómicamente,
   * y devuelve el caso. Si no hay nadie esperando, devuelve null.
   *
   * Lo usa `UsersService.setAvailability(true)` para activar a un
   * médico Y de paso asignarle el primer paciente que estaba aguardando.
   */
  async dispatchToDoctor(doctorId: string): Promise<CaseDocument | null> {
    const entry = await this.takeNext();
    if (!entry) return null;
    // takeNext popula `patient`, así que extraemos el _id robustamente.
    const patientObjectId = new Types.ObjectId(idOf(entry.patient));
    return this.cases.create(
      patientObjectId,
      new Types.ObjectId(doctorId),
      CaseType.CHAT,
      entry.reason,
    );
  }

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
   * Incluye información básica del paciente y se mapea a un shape "client-
   * friendly" con `position` (1-indexado) y `createdAt` (alias de joinedAt).
   */
  async list(): Promise<Array<Record<string, unknown>>> {
    const docs = await this.model
      .find()
      .sort({ joinedAt: 1 })
      .populate('patient', 'email firstName lastName')
      .exec();
    return docs.map((doc, idx) => {
      const plain = doc.toObject({ virtuals: true });
      return {
        ...plain,
        position: idx + 1,
        createdAt: plain.joinedAt,
        // En tu modelo actual no hay distinción chat/video en la entrada
        // de cola — el tipo se decide cuando se asigna. Defaulteamos a
        // 'chat' para el UI.
        type: (plain as { type?: string }).type ?? 'chat',
      };
    });
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
