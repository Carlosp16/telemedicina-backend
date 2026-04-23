import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Message, MessageDocument, MessageKind } from '../../schemas/message.schema';
import { CasesService } from '../cases/cases.service';
import { UsersService } from '../users/users.service';
import { CaseStatus, CaseType } from '../../schemas/case.schema';

/**
 * Servicio de chat.
 *
 * Responsabilidades:
 *  - Crear casos de chat entre paciente ↔ médico.
 *  - Persistir mensajes, aplicando validaciones (longitud, caracteres).
 *  - Listar mensajes por caso y mantener el contador de no-leídos.
 */
@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name) private readonly msgModel: Model<MessageDocument>,
    private readonly cases: CasesService,
    private readonly users: UsersService,
  ) {}

  /**
   * El paciente inicia un chat: se le asigna el médico disponible con
   * menor carga. Si no hay, se lanza 404 para que el cliente ofrezca
   * la sala de espera.
   */
  async startChat(patientId: string, reason?: string) {
    const doctor = await this.users.findAvailableDoctor();
    if (!doctor) {
      throw new NotFoundException(
        'No hay médicos disponibles para chat en este momento.',
      );
    }
    const kase = await this.cases.create(
      new Types.ObjectId(patientId),
      doctor._id as Types.ObjectId,
      CaseType.CHAT,
      reason,
    );
    return { case: kase, doctor };
  }

  /**
   * Guarda un mensaje de texto. Valida que el caso exista, esté ACTIVO
   * y que el remitente sea participante.
   */
  async postTextMessage(
    caseId: string,
    senderId: string,
    content: string,
  ): Promise<MessageDocument> {
    const kase = await this.assertParticipant(caseId, senderId);
    if (kase.status === CaseStatus.CLOSED) {
      throw new BadRequestException('El caso está cerrado; no se pueden enviar mensajes.');
    }

    const msg = await this.msgModel.create({
      case: new Types.ObjectId(caseId),
      sender: new Types.ObjectId(senderId),
      kind: MessageKind.TEXT,
      content,
      readBy: [new Types.ObjectId(senderId)],
    });
    return msg;
  }

  /**
   * Marca todos los mensajes de un caso como leídos por el usuario.
   */
  async markAsRead(caseId: string, userId: string): Promise<void> {
    await this.assertParticipant(caseId, userId);
    await this.msgModel.updateMany(
      { case: new Types.ObjectId(caseId), readBy: { $ne: new Types.ObjectId(userId) } },
      { $addToSet: { readBy: new Types.ObjectId(userId) } },
    );
  }

  async listMessages(caseId: string, userId: string): Promise<MessageDocument[]> {
    await this.assertParticipant(caseId, userId);
    return this.msgModel
      .find({ case: new Types.ObjectId(caseId) })
      .sort({ createdAt: 1 })
      .exec();
  }

  /**
   * Cuenta por caso cuántos mensajes están sin leer por el usuario dado.
   * Utilizado por el portal web para las fichas de conversación.
   */
  async unreadCount(caseId: string, userId: string): Promise<number> {
    return this.msgModel.countDocuments({
      case: new Types.ObjectId(caseId),
      readBy: { $ne: new Types.ObjectId(userId) },
    });
  }

  /**
   * Verifica que el usuario participe en el caso. Lanza 403 si no.
   */
  private async assertParticipant(caseId: string, userId: string) {
    const kase = await this.cases.findById(caseId);
    if (!kase) throw new NotFoundException('Caso no encontrado.');
    const participates =
      String(kase.patient) === userId || String(kase.doctor) === userId;
    if (!participates) {
      throw new ForbiddenException('No participas en este caso.');
    }
    return kase;
  }
}
