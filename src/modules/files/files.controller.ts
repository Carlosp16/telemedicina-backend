import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

import { FilesService } from './files.service';
import { UploadFileDto } from './dto/upload-file.dto';

@ApiTags('files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly service: FilesService) {}

  @Post('cases/:caseId/upload')
  @ApiOperation({
    summary: 'Subir un archivo (PDF/JPG/PNG, máximo 1 MB) a un caso.',
    description:
      'El archivo se envía en Base64. El servidor valida mime, peso y ' +
      'participación en el caso, persiste el mensaje y notifica por el ' +
      'ChatGateway al otro peer.',
  })
  upload(
    @Param('caseId') caseId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UploadFileDto,
  ) {
    return this.service.upload(caseId, user.sub, dto);
  }

  @Get('messages/:messageId')
  @ApiOperation({ summary: 'Descargar un archivo enviado (Base64).' })
  download(@Param('messageId') messageId: string, @CurrentUser() user: JwtPayload) {
    return this.service.download(messageId, user.sub);
  }
}
