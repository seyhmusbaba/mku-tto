import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectDocument } from '../database/entities/project-document.entity';
import { ProjectMember } from '../database/entities/project-member.entity';
import { Project } from '../database/entities/project.entity';
import { NotificationsService } from '../notifications/notifications.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(ProjectDocument) private docRepo: Repository<ProjectDocument>,
    @InjectRepository(ProjectMember) private memberRepo: Repository<ProjectMember>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    private notificationsService: NotificationsService,
  ) {}

  async findByProject(projectId: string) {
    const docs = await this.docRepo.find({
      where: { projectId },
      relations: ['uploadedBy'],
      order: { createdAt: 'DESC' },
    });

    // Versiyonları grupla — aynı originalDocumentId'ye sahip olanları birleştir
    const grouped = new Map<string, ProjectDocument[]>();
    docs.forEach(doc => {
      const key = doc.originalDocumentId || doc.id;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(doc);
    });

    // Her grup için en güncel versiyonu ana kayıt olarak döndür, versiyonlar listesiyle
    const result: any[] = [];
    grouped.forEach((versions, key) => {
      const sorted = versions.sort((a, b) => b.version - a.version);
      result.push({ ...sorted[0], versions: sorted });
    });

    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async canUpload(projectId: string, userId: string): Promise<boolean> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) return false;
    if (project.ownerId === userId) return true;
    const membership = await this.memberRepo.findOne({ where: { projectId, userId } as any });
    return !!membership && !!(membership as any).canUpload;
  }

  async create(projectId: string, userId: string, file: Express.Multer.File, dto: any) {
    if (!await this.canUpload(projectId, userId)) {
      throw new ForbiddenException('Bu projeye belge yükleme yetkiniz yok');
    }

    // Aynı isimde dosya var mı? Varsa yeni versiyon oluştur
    const existing = await this.docRepo.findOne({
      where: { projectId, name: dto.name || file.originalname },
      order: { version: 'DESC' },
    });

    const version = existing ? (existing.version || 1) + 1 : 1;
    const originalDocumentId = existing ? (existing.originalDocumentId || existing.id) : undefined;

    const doc = this.docRepo.create({
      projectId,
      uploadedById: userId,
      name: dto.name || file.originalname,
      fileName: file.filename,
      filePath: file.path,
      fileSize: file.size,
      mimeType: file.mimetype,
      type: dto.type || 'other',
      version,
      originalDocumentId,
    });

    const saved = await this.docRepo.save(doc);

    // Proje sahibine bildirim
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (project && project.ownerId !== userId) {
      await this.notificationsService.create({
        userId: project.ownerId,
        title: version > 1 ? 'Belge Güncellendi' : 'Yeni Belge Yüklendi',
        message: `"${project.title}" projesine "${saved.name}" ${version > 1 ? `v${version} ` : ''}yüklendi`,
        type: 'document',
        link: `/projects/${projectId}`,
      });
    }

    return saved;
  }

  async remove(id: string) {
    const doc = await this.docRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Belge bulunamadı');

    // Dosyayı diskten sil
    try {
      if (doc.filePath && fs.existsSync(doc.filePath)) {
        fs.unlinkSync(doc.filePath);
      }
    } catch {}

    return this.docRepo.remove(doc);
  }
}
