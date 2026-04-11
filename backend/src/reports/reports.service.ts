import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectReport } from '../database/entities/project-report.entity';
import { Project } from '../database/entities/project.entity';
import { ProjectMember } from '../database/entities/project-member.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { User } from '../database/entities/user.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(ProjectReport) private reportRepo: Repository<ProjectReport>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(ProjectMember) private memberRepo: Repository<ProjectMember>,
    private notificationsService: NotificationsService,
    private auditService: AuditService,
  ) {}

  findByProject(projectId: string) {
    return this.reportRepo.find({
      where: { projectId },
      relations: ['author'],
      order: { createdAt: 'DESC' },
    });
  }

  async create(projectId: string, authorId: string, dto: any) {
    const { metadata, ...safeDto } = dto;
    const reportData: any = { ...safeDto, projectId, authorId };

    if (metadata !== undefined) {
      try { reportData.metadata = typeof metadata === 'string' ? metadata : JSON.stringify(metadata); } catch {}
    }

    const report = this.reportRepo.create(reportData);
    let saved: ProjectReport;
    try {
      saved = await this.reportRepo.save(report) as unknown as ProjectReport;
    } catch (err: any) {
      if (err?.message?.includes('metadata') || err?.message?.includes('no column')) {
        const { metadata: _m, ...withoutMeta } = reportData;
        saved = await this.reportRepo.save(this.reportRepo.create(withoutMeta)) as unknown as ProjectReport;
      } else throw err;
    }

    // Notify: proje sahibi + tüm üyelere (rapor yazan hariç)
    try {
      const project = await this.projectRepo.findOne({ where: { id: projectId } });
      if (project) {
        const members = await this.memberRepo.find({ where: { projectId } });
        const recipients = [project.ownerId, ...members.map(m => m.userId)]
          .filter((uid, i, arr) => arr.indexOf(uid) === i && uid !== authorId);
        const TYPE_LABELS: Record<string, string> = {
          progress: 'İlerleme', milestone: 'Kilometre Taşı', financial: 'Finansal',
          technical: 'Teknik', risk: 'Risk', final: 'Final',
        };
        for (const uid of recipients) {
          await this.notificationsService.create({
            userId: uid,
            title: 'Yeni Rapor Eklendi',
            message: `"${project.title}" projesine ${TYPE_LABELS[dto.type] || 'yeni bir'} raporu eklendi: "${dto.title}"`,
            type: 'info',
            link: `/projects/${projectId}`,
          }).catch(() => {});
        }
      }
    } catch {}

    return saved;
  }

  async update(id: string, dto: any) {
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    const { metadata, ...safeDto } = dto;
    Object.assign(report, safeDto);
    if (metadata !== undefined) {
      try { (report as any).metadata = typeof metadata === 'string' ? metadata : JSON.stringify(metadata); } catch {}
    }
    const updatedReport = await this.reportRepo.save(report);
    await this.auditService.log({ entityType: 'project', entityId: (report as any).projectId, entityTitle: (report as any).title || 'Rapor', action: 'report_updated', detail: { title: (report as any).title } }).catch(() => {});
    return updatedReport;
  }

  async remove(id: string) {
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    const projectId = report.projectId;
    await this.reportRepo.remove(report);
    // Return latest progress for this project after deletion
    const latest = await this.reportRepo.findOne({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
    return { deleted: true, latestProgress: latest?.progressPercent || 0 };
  }
}
