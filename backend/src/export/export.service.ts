import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../database/entities/project.entity';

const STATUS_LABELS: Record<string, string> = {
  application: 'Başvuru', pending: 'Beklemede', active: 'Aktif',
  completed: 'Tamamlandı', suspended: 'Askıya Alındı', cancelled: 'İptal',
};
const TYPE_LABELS: Record<string, string> = {
  tubitak: 'TÜBİTAK', bap: 'BAP', eu: 'AB Projesi', industry: 'Sanayi', other: 'Diğer',
};

@Injectable()
export class ExportService {
  constructor(@InjectRepository(Project) private repo: Repository<Project>) {}

  private async getProjects(q: any): Promise<Project[]> {
    const qb = this.repo.createQueryBuilder('p')
      .leftJoinAndSelect('p.owner', 'owner')
      .leftJoinAndSelect('p.members', 'members')
      .leftJoinAndSelect('p.reports', 'reports')
      .orderBy('p.createdAt', 'DESC');

    if (q.status) qb.andWhere('p.status = :status', { status: q.status });
    if (q.type) qb.andWhere('p.type = :type', { type: q.type });
    if (q.faculty) qb.andWhere('p.faculty = :faculty', { faculty: q.faculty });

    return qb.getMany();
  }

  async exportProjectsCsv(q: any): Promise<string> {
    const projects = await this.getProjects(q);
    const headers = [
      'ID', 'Başlık', 'Durum', 'Tür', 'Fakülte', 'Bölüm',
      'Yürütücü', 'E-posta', 'Bütçe (₺)', 'Fon Kaynağı',
      'Başlangıç', 'Bitiş', 'Ekip Sayısı', 'Rapor Sayısı',
      'İlerleme (%)', 'Oluşturulma',
    ];

    const rows = projects.map(p => {
      const latestProgress = p.reports?.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0]?.progressPercent || 0;

      return [
        p.id,
        `"${(p.title || '').replace(/"/g, '""')}"`,
        STATUS_LABELS[p.status] || p.status,
        TYPE_LABELS[p.type] || p.type,
        p.faculty || '',
        p.department || '',
        p.owner ? `${p.owner.firstName} ${p.owner.lastName}` : '',
        p.owner?.email || '',
        p.budget || '',
        p.fundingSource || '',
        p.startDate || '',
        p.endDate || '',
        p.members?.length || 0,
        p.reports?.length || 0,
        latestProgress,
        new Date(p.createdAt).toLocaleDateString('tr-TR'),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  async exportProjectsJson(q: any) {
    const projects = await this.getProjects(q);
    return projects.map(p => ({
      id: p.id, title: p.title,
      status: STATUS_LABELS[p.status] || p.status,
      type: TYPE_LABELS[p.type] || p.type,
      faculty: p.faculty, department: p.department,
      budget: p.budget, fundingSource: p.fundingSource,
      startDate: p.startDate, endDate: p.endDate,
      owner: p.owner ? `${p.owner.firstName} ${p.owner.lastName}` : null,
      memberCount: p.members?.length || 0,
      reportCount: p.reports?.length || 0,
    }));
  }
}
