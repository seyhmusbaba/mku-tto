import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectDocument } from '../database/entities/project-document.entity';
import { ProjectMember } from '../database/entities/project-member.entity';
import { Project } from '../database/entities/project.entity';
import { NotificationsService } from '../notifications/notifications.service';
import * as fs from 'fs';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(ProjectDocument) private docRepo: Repository<ProjectDocument>,
    @InjectRepository(ProjectMember) private memberRepo: Repository<ProjectMember>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    private notificationsService: NotificationsService,
  ) {}

  findByProject(projectId: string) {
    return this.docRepo.find({ where: { projectId }, relations: ['uploadedBy'], order: { createdAt: 'DESC' } });
  }

  async canUserUpload(projectId: string, userId: string): Promise<boolean> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) return false;
    if (project.ownerId === userId) return true;
    const membership = await this.memberRepo.findOne({ where: { projectId, userId } });
    return !!membership && (membership as any).canUpload === 1;
  }

  async create(projectId: string, userId: string, file: any, dto: any) {
    const allowed = await this.canUserUpload(projectId, userId);
    if (!allowed) throw new ForbiddenException('Belge yükleme yetkiniz yok');

    let filePath = '';
    let fileName = dto.fileName || '';
    let fileSize = dto.size || 0;
    let mimeType = 'application/octet-stream';

    if (file) {
      // Multer disk storage
      filePath = file.path;
      fileName = file.originalname;
      fileSize = file.size;
      mimeType = file.mimetype;
    } else if (dto.fileData) {
      // Base64 JSON upload
      const base64 = dto.fileData;
      const matches = base64.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads', { recursive: true });
        filePath = `./uploads/${Date.now()}-${fileName}`;
        fs.writeFileSync(filePath, buffer);
        fileSize = buffer.length;
      }
    }

    const doc = this.docRepo.create({
      name: dto.name || fileName,
      fileName,
      filePath,
      fileSize,
      mimeType,
      type: dto.type || 'other',
      projectId,
      uploadedById: userId,
    });
    const saved = await this.docRepo.save(doc);

    // Notify project owner if uploader is a member
    try {
      const project = await this.projectRepo.findOne({ where: { id: projectId } });
      if (project && project.ownerId !== userId) {
        await this.notificationsService.create({
          userId: project.ownerId,
          title: 'Yeni Belge Yüklendi',
          message: `"${project.title}" projesine "${doc.name}" belgesi eklendi.`,
          type: 'info',
          link: `/projects/${projectId}`,
        });
      }
    } catch {}

    return saved;
  }

  async remove(id: string) {
    const doc = await this.docRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Belge bulunamadı');
    try { if (doc.filePath && fs.existsSync(doc.filePath)) fs.unlinkSync(doc.filePath); } catch {}
    return this.docRepo.remove(doc);
  }
}
