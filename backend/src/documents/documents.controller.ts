import { Controller, Get, Post, Delete, Param, Request, Body, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentsService } from './documents.service';

@Controller('projects/:projectId/documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.documentsService.findByProject(projectId);
  }

  // multipart/form-data upload (multer)
  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => cb(null, `${Date.now()}${extname(file.originalname)}`),
    }),
  }))
  create(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: any,
  ) {
    return this.documentsService.create(projectId, req.user.userId, file, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }
}
