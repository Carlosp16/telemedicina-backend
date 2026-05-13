import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  VideoSession,
  VideoSessionDocument,
  VideoSessionStatus,
} from '../../schemas/video-session.schema';
import { UsersService } from '../users/users.service';
import { CasesService } from '../cases/cases.service';
import { CaseType, CaseStatus } from '../../schemas/case.schema';
import { idOf } from '../../common/utils/refs';

/**
 * Servicio de videoconferencia.
 *
 * Maneja el ciclo de vida de una sesión:
 *  1. `createForPatient`: busca un médico disponible, crea caso + sesión
 *     en estado RINGING. Si no hay médico, lanza 404 (el cliente debería
 *     entonces ofrecer la lista de espera o la llamada al call center).
 *  2. `accept`: el médico acepta → status ACTIVE.
 *  3. `end`: cualquiera cuelga → status ENDED + cálculo de duración.
 *  4. `reject`: el médico rechaza antes de aceptar → status REJECTED.
 */
@Injectable()
export class VideoService {
  constructor(
    @InjectModel(VideoSession.name)
    private readonly model: Model<VideoSessionDocument>,
    private readonly users: UsersService,
    private readonly cases: CasesService,
  ) {}

  /**
   * El paciente solicita iniciar una videollamada.
   * @throws NotFoundException si no hay médicos disponibles.
   */
  async createForPatient(patientId: string, reason?: string) {
    const doctor = await this.users.findAvailableDoctor();
    if (!doctor) {
      throw new NotFoundException(
        'No hay médicos disponibles en este momento. Únete a la lista de espera.',
      );
    }

    const patientOid = new Types.ObjectId(patientId);
    const doctorOid = doctor._id as Types.ObjectId;

    const kase = await this.cases.create(patientOid, doctorOid, CaseType.VIDEO, reason);

    const session = await this.model.create({
      case: kase._id,
      patient: patientOid,
      doctor: doctorOid,
      status: VideoSessionStatus.RINGING,
    });

    return { session, case: kase, doctor };
  }

  /**
   * Inicia una sesión de video sobre un caso de chat existente. Útil para el
   * botón 📹 dentro del ChatScreen / CasePage: aprovecha el caso ya creado
   * en lugar de crear uno nuevo. Cualquiera de los participantes puede
   * iniciarla.
   */
  async createForExistingCase(caseId: string, callerId: string) {
    const kase = await this.cases.findById(caseId);
    if (!kase) throw new NotFoundException('Caso no encontrado.');
    if (kase.status === CaseStatus.CLOSED) {
      throw new BadRequestException('El caso está cerrado, no se pueden iniciar llamadas.');
    }
    const patientId = idOf(kase.patient);
    const doctorId = idOf(kase.doctor);
    const isParticipant = patientId === callerId || doctorId === callerId;
    if (!isParticipant) {
      throw new BadRequestException('No participas en este caso.');
    }

    const session = await this.model.create({
      case: kase._id,
      patient: new Types.ObjectId(patientId),
      doctor: new Types.ObjectId(doctorId),
      status: VideoSessionStatus.RINGING,
      initiatedBy: new Types.ObjectId(callerId),
    });

    return { session, case: kase };
  }

  async accept(sessionId: string, doctorId: string): Promise<VideoSessionDocument> {
    const session = await this.model.findById(sessionId);
    if (!session) throw new NotFoundException('Sesión no encontrada.');
    if (idOf(session.doctor) !== doctorId) {
      throw new BadRequestException('Esta sesión no está asignada a ti.');
    }
    if (session.status !== VideoSessionStatus.RINGING) {
      throw new BadRequestException('La sesión ya no puede aceptarse.');
    }
    session.status = VideoSessionStatus.ACTIVE;
    session.startedAt = new Date();
    await session.save();
    return session;
  }

  async reject(sessionId: string, doctorId: string): Promise<VideoSessionDocument> {
    const session = await this.model.findById(sessionId);
    if (!session) throw new NotFoundException('Sesión no encontrada.');
    if (idOf(session.doctor) !== doctorId) {
      throw new BadRequestException('Esta sesión no está asignada a ti.');
    }
    session.status = VideoSessionStatus.REJECTED;
    session.endedAt = new Date();
    session.endedBy = new Types.ObjectId(doctorId);
    await session.save();

    // Solo cerramos el caso si la sesión lo había creado (caso de type VIDEO).
    // Si la llamada se inició desde un chat existente, dejamos el caso vivo.
    const kase = await this.cases.findById(String(session.case));
    if (kase && kase.type === CaseType.VIDEO) {
      await this.cases.close(String(session.case), new Types.ObjectId(doctorId));
    }
    return session;
  }

  async end(sessionId: string, userId: string): Promise<VideoSessionDocument> {
    const session = await this.model.findById(sessionId);
    if (!session) throw new NotFoundException('Sesión no encontrada.');

    const participant =
      idOf(session.patient) === userId || idOf(session.doctor) === userId;
    if (!participant) throw new BadRequestException('No participas en esta sesión.');

    if (session.status === VideoSessionStatus.ENDED) return session;

    session.status = VideoSessionStatus.ENDED;
    session.endedAt = new Date();
    session.endedBy = new Types.ObjectId(userId);
    // Si la llamada nunca arrancó (rechazada/no contestada), startedAt puede
    // ser null — protegemos el cálculo de duración.
    session.durationSec = session.startedAt
      ? Math.max(
          0,
          Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 1000),
        )
      : 0;
    await session.save();

    // No cerramos el caso: el usuario puede querer seguir chateando después
    // de la llamada. El caso lo cierra el médico explícitamente.
    return session;
  }

  findById(id: string): Promise<VideoSessionDocument | null> {
    return this.model.findById(id).exec();
  }
}
