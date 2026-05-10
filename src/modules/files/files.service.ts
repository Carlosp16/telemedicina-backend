import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Message, MessageDocument, MessageKind } from '../../schemas/message.schema';
import { CasesService } from '../cases/cases.service';
import { CaseStatus } from '../../schemas/case.schema';
import { ChatGateway } from '../chat/chat.gateway';
import { UploadFileDto } from './dto/upload-file.dto';
import { idOf } from '../../common/utils/refs';

/**
 * Servicio de transferencia de archivos.
 *
 * Los archivos se guardan como mensajes de `kind=file` dentro del caso
 * correspondiente. El contenido se almacena en Base64 tal como llega,
 * alineado con la decisión del TEG.
 *
 * Alternativa recomendada en producción: subir a S3 / GridFS y guardar
 * sólo la URL o el ObjectId del blob.
 */
@Injectable()
export class FilesService {
  private readonly maxSize: number;
  private readonly allowedMime: readonly string[];

  constructor(
    @InjectModel(Message.name) private readonly msgModel: Model<MessageDocument>,
    private readonly cases: CasesService,
    private readonly chatGateway: ChatGateway,
    private readonly config: ConfigService,
  ) {
    this.maxSize = this.config.get<number>('files.maxSize') ?? 1048576;
    this.allowedMime = this.config.get<readonly string[]>('files.allowedMime') ?? [];
  }

  /**
   * Sube un archivo a un caso. Valida participación, estado del caso,
   * tamaño y mime. Al persistirse, emite el mensaje por el ChatGateway
   * para notificar al otro participante en tiempo real.
   */
  async upload(
    caseId: string,
    senderId: string,
    dto: UploadFileDto,
  ): Promise<MessageDocument> {
    if (!this.allowedMime.includes(dto.mimeType)) {
      throw new BadRequestException('Tipo de archivo no permitido.');
    }
    if (dto.size > this.maxSize) {
      throw new PayloadTooLargeException(
        `El archivo excede el tamaño máximo de ${this.maxSize} bytes.`,
      );
    }

    // Verificamos peso real del Base64 decodificado.
    const realSize = Buffer.from(dto.data, 'base64').length;
    if (realSize !== dto.size) {
      throw new BadRequestException(
        'El tamaño declarado no coincide con el contenido real del archivo.',
      );
    }
    if (realSize > this.maxSize) {
      throw new PayloadTooLargeException('El archivo excede el tamaño máximo.');
    }

    const kase = await this.cases.findById(caseId);
    if (!kase) throw new NotFoundException('Caso no encontrado.');
    if (kase.status === CaseStatus.CLOSED) {
      throw new BadRequestException('El caso está cerrado.');
    }
    const participates =
      idOf(kase.patient) === senderId || idOf(kase.doctor) === senderId;
    if (!participates) {
      throw new ForbiddenException('No participas en este caso.');
    }

    const msg = await this.msgModel.create({
      case: new Types.ObjectId(caseId),
      sender: new Types.ObjectId(senderId),
      kind: MessageKind.FILE,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      fileSize: realSize,
      fileData: dto.data,
      readBy: [new Types.ObjectId(senderId)],
    });

    // Notificación en tiempo real al otro peer (vía el ChatGateway reutilizado).
    // Enviamos una versión "ligera" sin el Base64 para no saturar el socket;
    // el cliente pide el contenido con `GET /files/messages/:id` cuando lo abre.
    const light = {
      ...msg.toJSON(),
      fileData: undefined,
    };
    this.chatGateway.emitMessage(caseId, light);

    return msg;
  }

  /**
   * Descarga: devuelve el mensaje con `fileData` completo, sólo a participantes.
   */
  async download(messageId: string, userId: string) {
    const msg = await this.msgModel.findById(messageId);
    if (!msg || msg.kind !== MessageKind.FILE) {
      throw new NotFoundException('Archivo no encontrado.');
    }
    const kase = await this.cases.findById(String(msg.case));
    if (!kase) throw new NotFoundException('Caso asociado inexistente.');
    const participates =
      idOf(kase.patient) === userId || idOf(kase.doctor) === userId;
    if (!participates) throw new ForbiddenException('Acceso denegado.');

    return {
      fileName: msg.fileName,
      mimeType: msg.mimeType,
      size: msg.fileSize,
      data: msg.fileData, // Base64
    };
  }
}
