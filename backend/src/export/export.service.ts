import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../database/entities/project.entity';

const STATUS_LABELS: Record<string, string> = {
  application: 'Basvuru', pending: 'Beklemede', active: 'Aktif',
  completed: 'Tamamlandi', suspended: 'Askiya Alindi', cancelled: 'Iptal',
};
const TYPE_LABELS: Record<string, string> = {
  tubitak: 'TUBITAK', bap: 'BAP', eu: 'AB Projesi', industry: 'Sanayi', other: 'Diger',
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

  async exportProjectsCsv(q: any): Promise<Buffer> {
    const projects = await this.getProjects(q);
    const SEP = '\t';
    const headers = [
      'ID', 'Baslik', 'Durum', 'Tur', 'Fakulte', 'Bolum',
      'Yurutucu', 'Eposta', 'Butce', 'Fon',
      'Baslangic', 'Bitis', 'Ekip', 'Rapor', 'Ilerleme', 'Tarih',
    ];
    const clean = (v: any): string => {
      return String(v == null ? '' : v).replace(/\t/g, ' ').replace(/\n/g, ' ');
    };
    const rows = projects.map(p => {
      const progress = p.reports && p.reports.length > 0
        ? (p.reports.sort((a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0] as any).progressPercent || 0
        : 0;
      const ownerName = p.owner ? (p.owner.firstName + ' ' + p.owner.lastName) : '';
      const ownerEmail = p.owner ? p.owner.email : '';
      return [
        clean(p.id), clean(p.title),
        clean(STATUS_LABELS[p.status] || p.status),
        clean(TYPE_LABELS[p.type] || p.type),
        clean(p.faculty), clean(p.department),
        clean(ownerName), clean(ownerEmail),
        clean(p.budget || ''), clean(p.fundingSource || ''),
        clean(p.startDate || ''), clean(p.endDate || ''),
        clean(p.members ? p.members.length : 0),
        clean(p.reports ? p.reports.length : 0),
        clean(progress),
        clean(new Date(p.createdAt).toLocaleDateString('tr-TR')),
      ].join(SEP);
    });
    const content = [headers.join(SEP), ...rows].join('\r\n');
    const utf16 = Buffer.from(content, 'utf16le');
    const bom = Buffer.from([0xFF, 0xFE]);
    return Buffer.concat([bom, utf16]);
  }

  async exportProjectsJson(q: any): Promise<any[]> {
    const projects = await this.getProjects(q);
    return projects.map(p => ({
      id: p.id,
      title: p.title,
      status: STATUS_LABELS[p.status] || p.status,
      type: TYPE_LABELS[p.type] || p.type,
      faculty: p.faculty,
      department: p.department,
      budget: p.budget,
      fundingSource: p.fundingSource,
      startDate: p.startDate,
      endDate: p.endDate,
      owner: p.owner ? (p.owner.firstName + ' ' + p.owner.lastName) : null,
      memberCount: p.members ? p.members.length : 0,
      reportCount: p.reports ? p.reports.length : 0,
    }));
  }
}
