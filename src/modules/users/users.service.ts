import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';

import { User, UserDocument, UserRole } from '../../schemas/user.schema';
import { AccessCodesService } from '../access-codes/access-codes.service';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

/**
 * Servicio que encapsula la lógica de negocio de los usuarios.
 *
 * Reglas clave:
 *  - Toda creación pasa por hashing bcrypt.
 *  - El registro de un paciente consume un código de acceso (una sola vez).
 *  - Los médicos los da de alta un administrador (no hay self-service).
 *  - La modificación de email o contraseña requiere la contraseña actual.
 */
@Injectable()
export class UsersService {
  private readonly rounds: number;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly config: ConfigService,
    private readonly accessCodes: AccessCodesService,
  ) {
    this.rounds = this.config.get<number>('security.bcryptRounds') ?? 10;
  }

  // ---------------------------------------------------------------------------
  // Lecturas básicas
  // ---------------------------------------------------------------------------

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  // ---------------------------------------------------------------------------
  // Registro de paciente
  // ---------------------------------------------------------------------------

  /**
   * Registra un paciente nuevo. Pasos:
   *  1. Valida que el código de acceso sea usable (existente, no usado, no vencido).
   *  2. Valida que el email no esté tomado.
   *  3. Hashea la contraseña con bcrypt.
   *  4. Crea el usuario con rol PACIENTE.
   *  5. Marca el código como consumido apuntando al usuario recién creado.
   */
  async registerPatient(dto: RegisterPatientDto): Promise<UserDocument> {
    const code = await this.accessCodes.assertUsable(dto.accessCode);

    const email = dto.email.toLowerCase().trim();
    if (await this.userModel.exists({ email })) {
      throw new ConflictException('El correo electrónico ya está registrado.');
    }

    const hashed = await bcrypt.hash(dto.password, this.rounds);
    const user = await this.userModel.create({
      email,
      password: hashed,
      role: UserRole.PACIENTE,
      firstName: dto.firstName,
      lastName: dto.lastName,
      registrationCode: code.code,
      isActive: true,
    });

    await this.accessCodes.consume(
      code._id as Types.ObjectId,
      user._id as Types.ObjectId,
    );
    return user;
  }

  // ---------------------------------------------------------------------------
  // Alta de médicos (admin)
  // ---------------------------------------------------------------------------

  /**
   * Lista todos los médicos del sistema. Útil para el panel del admin.
   * No incluye campos sensibles (la contraseña hash no se expone por el
   * select implícito del schema).
   */
  listDoctors(): Promise<UserDocument[]> {
    return this.userModel
      .find({ role: UserRole.MEDICO })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Lista todos los pacientes del sistema.
   */
  listPatients(): Promise<UserDocument[]> {
    return this.userModel
      .find({ role: UserRole.PACIENTE })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Actualiza un médico desde el panel admin. Campos editables:
   * firstName, lastName, specialty, licenseNumber, isActive.
   */
  async updateDoctor(doctorId: string, dto: UpdateDoctorDto): Promise<UserDocument> {
    const doctor = await this.userModel.findOne({
      _id: doctorId,
      role: UserRole.MEDICO,
    });
    if (!doctor) throw new NotFoundException('Médico no encontrado.');

    if (dto.firstName !== undefined) doctor.firstName = dto.firstName;
    if (dto.lastName !== undefined) doctor.lastName = dto.lastName;
    if (dto.specialty !== undefined) doctor.specialty = dto.specialty;
    if (dto.licenseNumber !== undefined) doctor.licenseNumber = dto.licenseNumber;
    if (dto.isActive !== undefined) {
      doctor.isActive = dto.isActive;
      // Si lo desactivamos, también lo sacamos de la cola de disponibles
      // para que no le lleguen pacientes nuevos.
      if (!dto.isActive) doctor.available = false;
    }
    await doctor.save();
    return doctor;
  }

  /**
   * Actualiza un paciente desde el panel admin. Mayormente para activar /
   * desactivar; los datos personales los modifica el propio paciente.
   */
  async updatePatient(patientId: string, dto: UpdatePatientDto): Promise<UserDocument> {
    const patient = await this.userModel.findOne({
      _id: patientId,
      role: UserRole.PACIENTE,
    });
    if (!patient) throw new NotFoundException('Paciente no encontrado.');

    if (dto.firstName !== undefined) patient.firstName = dto.firstName;
    if (dto.lastName !== undefined) patient.lastName = dto.lastName;
    if (dto.isActive !== undefined) patient.isActive = dto.isActive;
    await patient.save();
    return patient;
  }

  async createDoctor(dto: CreateDoctorDto): Promise<UserDocument> {
    const email = dto.email.toLowerCase().trim();
    if (await this.userModel.exists({ email })) {
      throw new ConflictException('El correo electrónico ya está registrado.');
    }
    const hashed = await bcrypt.hash(dto.password, this.rounds);
    return this.userModel.create({
      email,
      password: hashed,
      role: UserRole.MEDICO,
      firstName: dto.firstName,
      lastName: dto.lastName,
      specialty: dto.specialty,
      licenseNumber: dto.licenseNumber,
      available: false,
      isActive: true,
    });
  }

  // ---------------------------------------------------------------------------
  // Administrador inicial (seed)
  // ---------------------------------------------------------------------------

  async createAdminIfNotExists(email: string, password: string): Promise<void> {
    const normalized = email.toLowerCase().trim();
    const exists = await this.userModel.exists({ email: normalized });
    if (exists) return;
    const hashed = await bcrypt.hash(password, this.rounds);
    await this.userModel.create({
      email: normalized,
      password: hashed,
      role: UserRole.ADMIN,
      isActive: true,
    });
  }

  // ---------------------------------------------------------------------------
  // Gestión de la propia cuenta
  // ---------------------------------------------------------------------------

  async updateOwnAccount(
    userId: string,
    dto: UpdateAccountDto,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    const mutatesSensitive = dto.email !== undefined || dto.password !== undefined;
    if (mutatesSensitive) {
      if (!dto.currentPassword) {
        throw new BadRequestException(
          'Debe confirmar su contraseña actual para modificar email o contraseña.',
        );
      }
      const ok = await bcrypt.compare(dto.currentPassword, user.password);
      if (!ok) throw new UnauthorizedException('Contraseña actual incorrecta.');
    }

    if (dto.email) {
      const newEmail = dto.email.toLowerCase().trim();
      if (newEmail !== user.email && (await this.userModel.exists({ email: newEmail }))) {
        throw new ConflictException('Ese correo ya está en uso.');
      }
      user.email = newEmail;
    }
    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;

    if (dto.password) {
      user.password = await bcrypt.hash(dto.password, this.rounds);
    }

    await user.save();
    return user;
  }

  // ---------------------------------------------------------------------------
  // Ayudantes internos usados por otros módulos (auth, video, chat)
  // ---------------------------------------------------------------------------

  async registerFailedLogin(userId: Types.ObjectId): Promise<UserDocument | null> {
    const max = this.config.get<number>('security.maxLoginAttempts') ?? 3;
    return this.userModel
      .findByIdAndUpdate(
        userId,
        [
          {
            $set: {
              failedLoginAttempts: { $add: ['$failedLoginAttempts', 1] },
            },
          },
          {
            $set: {
              isActive: {
                $cond: [{ $gte: ['$failedLoginAttempts', max] }, false, '$isActive'],
              },
            },
          },
        ],
        { new: true },
      )
      .exec();
  }

  async resetLoginCounters(userId: Types.ObjectId): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { failedLoginAttempts: 0, isActive: true } },
    );
  }

  async setAvailability(userId: string, available: boolean): Promise<void> {
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId), role: UserRole.MEDICO },
      { $set: { available } },
    );
  }

  async incrementActiveCases(userId: Types.ObjectId, delta: 1 | -1): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { $inc: { activeCases: delta } });
  }

  /** Vuelve la carga activa de un médico a 0 (tras cerrar todos sus casos). */
  async resetActiveCases(userId: Types.ObjectId): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { $set: { activeCases: 0 } });
  }

  /**
   * Busca un médico disponible con la menor carga de trabajo.
   * Devuelve null si no hay ningún médico disponible.
   */
  findAvailableDoctor(): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ role: UserRole.MEDICO, available: true, isActive: true })
      .sort({ activeCases: 1, updatedAt: 1 })
      .exec();
  }

  async setPassword(userId: Types.ObjectId, newPassword: string): Promise<void> {
    const hashed = await bcrypt.hash(newPassword, this.rounds);
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { password: hashed, failedLoginAttempts: 0, isActive: true } },
    );
  }
}
