import { Controller, Get, Post, Delete, Param, Request, Body, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentsService } from './documents.service';

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.png', '.jpg', '.jpeg', '.zip'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

@Controller('projects/:projectId/documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.documentsService.findByProject(projectId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => cb(null, `${Date.now()}${extname(file.originalname)}`),
    }),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return cb(new BadRequestException(`İzin verilmeyen dosya tipi: ${ext}. İzinliler: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
      }
      cb(null, true);
    },
  }))
  create(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: any,
  ) {
    if (!file) throw new BadRequestException('Dosya yüklenmedi');
    return this.documentsService.create(projectId, req.user.userId, file, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }
}
