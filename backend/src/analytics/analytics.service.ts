import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';
import { ProjectReport } from '../database/entities/project-report.entity';
import { SystemSetting } from '../database/entities/system-setting.entity';

// Global erişim rolleri - tüm sistemin analizine erişir
const GLOBAL_ROLES = ['Süper Admin', 'Rektör'];

type AnalyticsScope =
  | { kind: 'global' }
  | { kind: 'faculty'; faculty: string }
  | { kind: 'department'; department: string }
  | { kind: 'user'; userId: string };

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(ProjectReport) private reportRepo: Repository<ProjectReport>,
    @InjectRepository(SystemSetting) private settingRepo: Repository<SystemSetting>,
  ) {}

  // Rol + DB ayarından scope'u çözer
  private async resolveScope(userId: string, roleName: string): Promise<AnalyticsScope> {
    const r = (roleName || '');
    if (GLOBAL_ROLES.includes(r) || r.toLowerCase().includes('rekt')) {
      return { kind: 'global' };
    }
    // Ayarlarda global yetki verilmiş mi?
    try {
      const setting = await this.settingRepo.findOne({ where: { key: 'analytics_full_access_roles' } });
      if (setting?.value) {
        const roles = JSON.parse(setting.value) as string[];
        if (roles.includes(r)) return { kind: 'global' };
      }
    } catch {}
    // Dekan → kendi fakültesi, Bölüm Başkanı → kendi bölümü
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (r === 'Dekan' && user?.faculty) return { kind: 'faculty', faculty: user.faculty };
    if (r === 'Bölüm Başkanı' && user?.department) return { kind: 'department', department: user.department };
    return { kind: 'user', userId };
  }

  private applyScope<T>(qb: SelectQueryBuilder<T>, alias: string, scope: AnalyticsScope): SelectQueryBuilder<T> {
    if (scope.kind === 'faculty') qb.andWhere(`${alias}.faculty = :scopeFaculty`, { scopeFaculty: scope.faculty });
    if (scope.kind === 'department') qb.andWhere(`${alias}.department = :scopeDepartment`, { scopeDepartment: scope.department });
    return qb;
  }

  /**
   * Ortak proje filtresi - year/faculty/type/from/to parametrelerini QB'ye uygular.
   * Tüm analytics endpoint'leri bu helper'dan geçerse filtre davranışı
   * sekmeler arasında tutarlı olur.
   */
  private applyProjectFilters<T>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    f: { year?: string; faculty?: string; type?: string; from?: string; to?: string } = {},
  ): SelectQueryBuilder<T> {
    if (f.year) qb.andWhere(`${alias}."startDate" IS NOT NULL AND SUBSTRING(${alias}."startDate", 1, 4) = :fYear`, { fYear: String(f.year) });
    if (f.from) qb.andWhere(`${alias}."startDate" IS NOT NULL AND ${alias}."startDate" >= :fFrom`, { fFrom: f.from });
    if (f.to)   qb.andWhere(`${alias}."startDate" IS NOT NULL AND ${alias}."startDate" <= :fTo`,   { fTo: f.to });
    if (f.faculty) qb.andWhere(`${alias}.faculty = :fFaculty`, { fFaculty: f.faculty });
    if (f.type)    qb.andWhere(`${alias}.type = :fType`,       { fType: f.type });
    return qb;
  }

  // Geriye uyumluluk - eski signature kullanan yerler kalırsa false döner
  private async hasFullAccess(roleName: string): Promise<boolean> {
    if (GLOBAL_ROLES.includes(roleName)) return true;
    try {
      const setting = await this.settingRepo.findOne({ where: { key: 'analytics_full_access_roles' } });
      if (setting?.value) {
        const roles = JSON.parse(setting.value) as string[];
        return roles.includes(roleName);
      }
    } catch {}
    return false;
  }

  // Kullanıcının erişebildiği proje ID'leri
  private async getUserProjectIds(userId: string): Promise<string[]> {
    const owned = await this.projectRepo.createQueryBuilder('p')
      .select('p.id')
      .where('p."ownerId" = :userId', { userId })
      .getRawMany();
    const membered = await this.projectRepo.createQueryBuilder('p')
      .innerJoin('project_members', 'pm', 'pm."projectId" = p.id')
      .select('p.id')
      .where('pm."userId" = :userId', { userId })
      .getRawMany();
    const ids = [...new Set([...owned.map(r => r.p_id), ...membered.map(r => r.p_id)])];
    return ids;
  }

  async getOverview(q: { year?: string; faculty?: string; type?: string; from?: string; to?: string }, userId: string, roleName: string) {
    const scope = await this.resolveScope(userId, roleName);
    const qb = this.projectRepo.createQueryBuilder('p');

    if (scope.kind === 'user') {
      const ids = await this.getUserProjectIds(userId);
      if (!ids.length) return { total: 0, byStatus: [], totalBudget: 0, activeBudget: 0, successRate: 0, avgBudget: 0, restricted: true, scope: scope.kind };
      qb.where('p.id IN (:...ids)', { ids });
    } else {
      this.applyScope(qb, 'p', scope);
    }

    this.applyProjectFilters(qb, 'p', q);

    const projects = await qb.getMany();
    const total = projects.length;

    // Sadece gerçekten bulunan statüleri döndür - 0 olanları gizle (hayalet durumları önler)
    const statusCounts: Record<string, number> = {};
    for (const p of projects) {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    }
    const STATUS_ORDER = ['application','pending','active','completed','suspended','cancelled'];
    const byStatus = STATUS_ORDER
      .filter(s => statusCounts[s] > 0)
      .map(s => ({ status: s, count: statusCounts[s] }));

    const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0);
    const activeBudget = projects.filter(p => p.status === 'active').reduce((s, p) => s + (p.budget || 0), 0);
    const completed = projects.filter(p => p.status === 'completed').length;
    const active = projects.filter(p => p.status === 'active').length;
    const cancelled = projects.filter(p => p.status === 'cancelled').length;
    const pending = projects.filter(p => ['application','pending'].includes(p.status)).length;
    const suspended = projects.filter(p => p.status === 'suspended').length;
    // 3 ana oran - toplam proje sayısı üzerinden (anlamlı ve tutarlı)
    const activeRate = total > 0 ? Math.round((active / total) * 100) : 0;
    const completedRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const pendingRate = total > 0 ? Math.round((pending / total) * 100) : 0;
    const avgBudget = total > 0 ? Math.round(totalBudget / total) : 0;

    // Proje türüne göre dağılım
    const typeCounts: Record<string, number> = {};
    for (const p of projects) {
      const t = p.type || 'other';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
    const byType = Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    // Basari orani: kararlasan (tamamlanan + iptal) projelerden tamamlananlarin payi
    // Ornek: 10 kararlasan proje - 8 tamamlanmis, 2 iptal => %80 basari
    const decided = completed + cancelled;
    const successRate = decided > 0 ? Math.round((completed / decided) * 100) : 0;

    return {
      total, byStatus, byType, totalBudget, activeBudget, avgBudget,
      // 3 ana oran
      activeRate, completedRate, pendingRate,
      // Basari orani (kararlasan projeler bazli)
      successRate,
      decidedProjects: decided,
      // Durum bazlı sayılar
      activeProjects: active,
      completedProjects: completed,
      cancelledProjects: cancelled,
      pendingProjects: pending,
      suspendedProjects: suspended,
      completed,
      restricted: scope.kind !== 'global',
      scope: scope.kind,
      scopeValue: scope.kind === 'faculty' ? scope.faculty : scope.kind === 'department' ? scope.department : null,
    };
  }

  async getFacultyPerformance(
    q: { year?: string; faculty?: string; type?: string; from?: string; to?: string } = {},
    userId: string,
    roleName: string,
  ) {
    const scope = await this.resolveScope(userId, roleName);
    const qb = this.projectRepo.createQueryBuilder('p')
      .select([
        'p.faculty as faculty',
        'COUNT(*) as total',
        `SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completed`,
        `SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) as active`,
        `SUM(CASE WHEN p.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled`,
        'AVG(p.budget) as "avgBudget"',
        'SUM(p.budget) as "totalBudget"',
      ])
      .where('p.faculty IS NOT NULL');

    if (scope.kind === 'user') {
      const ids = await this.getUserProjectIds(userId);
      if (!ids.length) return [];
      qb.andWhere('p.id IN (:...ids)', { ids });
    } else {
      this.applyScope(qb, 'p', scope);
    }
    this.applyProjectFilters(qb, 'p', q);

    const raw = await qb.groupBy('p.faculty')
      .addSelect(`SUM(CASE WHEN p.status IN ('application','pending') THEN 1 ELSE 0 END)`, 'pending')
      .orderBy('total', 'DESC').getRawMany();
    return raw.map(r => {
      const total = +r.total;
      return {
        faculty: r.faculty, total, completed: +r.completed, active: +r.active,
        cancelled: +r.cancelled, pending: +(r.pending || 0),
        activeRate:    total > 0 ? Math.round((+r.active / total) * 100) : 0,
        completedRate: total > 0 ? Math.round((+r.completed / total) * 100) : 0,
        pendingRate:   total > 0 ? Math.round(((+(r.pending || 0)) / total) * 100) : 0,
        avgBudget: Math.round(+r.avgBudget || 0), totalBudget: Math.round(+r.totalBudget || 0),
      };
    });
  }

  async getResearcherProductivity(
    q: { limit?: string; year?: string; faculty?: string; type?: string; from?: string; to?: string },
    userId: string,
    roleName: string,
  ) {
    const scope = await this.resolveScope(userId, roleName);
    // Limit: 10 default, 0 = tümü, max 500 (aşırı yük önlem)
    const limitRaw = parseInt(q.limit || '10');
    const useLimit = limitRaw > 0;
    const limit = useLimit ? Math.min(limitRaw, 500) : 0;

    const qb = this.projectRepo.createQueryBuilder('p')
      .select([
        'p."ownerId" as "ownerId"',
        'COUNT(*) as total',
        `SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completed`,
        `SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) as active`,
        'SUM(p.budget) as "totalBudget"',
      ])
      .where('p."ownerId" IS NOT NULL');

    if (scope.kind === 'user') {
      qb.andWhere('p."ownerId" = :userId', { userId });
    } else {
      this.applyScope(qb, 'p', scope);
    }
    this.applyProjectFilters(qb, 'p', q);

    qb.groupBy('p."ownerId"').orderBy('total', 'DESC');
    if (useLimit) qb.limit(limit);
    const raw = await qb.getRawMany();
    const userIds = raw.map(r => r.ownerId);
    if (!userIds.length) return [];
    const users = await this.userRepo.findByIds(userIds);
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    return raw.map(r => {
      const u = userMap[r.ownerId];
      return {
        userId: r.ownerId,
        name: u ? `${u.title || ''} ${u.firstName} ${u.lastName}`.trim() : 'Bilinmiyor',
        faculty: u?.faculty || '-', department: u?.department || '-',
        total: +r.total, completed: +r.completed, active: +r.active,
        totalBudget: Math.round(+r.totalBudget || 0),
        score: +r.total * 10 + +r.completed * 15,
      };
    });
  }

  async getFundingSuccess(
    q: { year?: string; faculty?: string; type?: string; from?: string; to?: string } = {},
    userId: string,
    roleName: string,
  ) {
    const scope = await this.resolveScope(userId, roleName);
    const qb = this.projectRepo.createQueryBuilder('p')
      .select([
        'p.type as type',
        'COUNT(*) as total',
        `SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completed`,
        `SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) as active`,
        `SUM(CASE WHEN p.status IN ('application','pending') THEN 1 ELSE 0 END) as pending`,
        `SUM(CASE WHEN p.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled`,
        'AVG(p.budget) as "avgBudget"',
        'SUM(p.budget) as "totalBudget"',
      ]);

    if (scope.kind === 'user') {
      const ids = await this.getUserProjectIds(userId);
      if (!ids.length) return [];
      qb.where('p.id IN (:...ids)', { ids });
    } else {
      this.applyScope(qb, 'p', scope);
    }
    this.applyProjectFilters(qb, 'p', q);

    const raw = await qb.groupBy('p.type').orderBy('total', 'DESC').getRawMany();
    return raw.map(r => {
      const total = +r.total;
      return {
        type: r.type, total, completed: +r.completed, active: +r.active,
        pending: +r.pending, cancelled: +r.cancelled,
        activeRate:    total > 0 ? Math.round((+r.active / total) * 100) : 0,
        completedRate: total > 0 ? Math.round((+r.completed / total) * 100) : 0,
        pendingRate:   total > 0 ? Math.round((+r.pending / total) * 100) : 0,
        avgBudget: Math.round(+r.avgBudget || 0), totalBudget: Math.round(+r.totalBudget || 0),
      };
    });
  }

  /**
   * Fon kaynağı bazlı kırılım (TÜBİTAK, Rektörlük, Sanayi, AB vs.).
   * Project.fundingSource alanı üzerinden gruplar. Boş/NULL kaynaklar
   * "Belirtilmemiş" olarak toplanır.
   */
  async getFundingSourceBreakdown(
    q: { year?: string; faculty?: string; type?: string; from?: string; to?: string } = {},
    userId: string,
    roleName: string,
  ) {
    const scope = await this.resolveScope(userId, roleName);
    const qb = this.projectRepo.createQueryBuilder('p')
      .select([
        `COALESCE(NULLIF(TRIM(p."fundingSource"), ''), 'Belirtilmemiş') as source`,
        'COUNT(*) as total',
        `SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completed`,
        `SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) as active`,
        `SUM(CASE WHEN p.status IN ('application','pending') THEN 1 ELSE 0 END) as pending`,
        `SUM(CASE WHEN p.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled`,
        'AVG(p.budget) as "avgBudget"',
        'SUM(p.budget) as "totalBudget"',
        'MAX(p.budget) as "maxBudget"',
      ]);

    if (scope.kind === 'user') {
      const ids = await this.getUserProjectIds(userId);
      if (!ids.length) return [];
      qb.where('p.id IN (:...ids)', { ids });
    } else {
      this.applyScope(qb, 'p', scope);
    }
    this.applyProjectFilters(qb, 'p', q);

    const raw = await qb
      .groupBy(`COALESCE(NULLIF(TRIM(p."fundingSource"), ''), 'Belirtilmemiş')`)
      .orderBy('total', 'DESC')
      .getRawMany();

    // Kaynak adı normalleştirme - "tubitak" / "TUBİTAK" / "TÜBİTAK" aynı bucket'a
    const normalized = new Map<string, any>();
    for (const r of raw) {
      const key = this.normalizeFundingSource(r.source);
      if (normalized.has(key)) {
        const existing = normalized.get(key);
        existing.total += +r.total;
        existing.completed += +r.completed;
        existing.active += +r.active;
        existing.pending += +r.pending;
        existing.cancelled += +r.cancelled;
        existing.totalBudget += +r.totalBudget || 0;
        existing.maxBudget = Math.max(existing.maxBudget, +r.maxBudget || 0);
        existing.avgBudget = existing.totalBudget / existing.total;
      } else {
        normalized.set(key, {
          source: key,
          originalLabels: [r.source],
          total: +r.total,
          completed: +r.completed,
          active: +r.active,
          pending: +r.pending,
          cancelled: +r.cancelled,
          totalBudget: +r.totalBudget || 0,
          avgBudget: +r.avgBudget || 0,
          maxBudget: +r.maxBudget || 0,
        });
      }
    }

    return Array.from(normalized.values())
      .map(x => ({
        ...x,
        activeRate:    x.total > 0 ? Math.round((x.active / x.total) * 100) : 0,
        completedRate: x.total > 0 ? Math.round((x.completed / x.total) * 100) : 0,
        pendingRate:   x.total > 0 ? Math.round((x.pending / x.total) * 100) : 0,
        avgBudget: Math.round(x.avgBudget || 0),
        totalBudget: Math.round(x.totalBudget),
        maxBudget: Math.round(x.maxBudget),
      }))
      .sort((a, b) => b.total - a.total);
  }

  /**
   * Fon kaynağı adlarını kanonik forma çevirir. Aynı kaynağın farklı
   * yazımları tek bucket'ta toplanır.
   */
  private normalizeFundingSource(raw: string): string {
    if (!raw) return 'Belirtilmemiş';
    const lower = raw.toLowerCase().trim();
    if (/^(tübitak|tubitak|tüb[iı]tak)/i.test(lower)) return 'TÜBİTAK';
    if (/kosgeb/i.test(lower)) return 'KOSGEB';
    if (/rekt[oö]rl[uü]k|mk[uü]|bap|iç kaynak/i.test(lower)) return 'Rektörlük / BAP';
    if (/horizon|h2020|avrupa|european|eu |erc|erasmus|cost/i.test(lower)) return 'AB / Horizon Europe';
    if (/kalk[ıi]nma|dka|doka|çka|mka|kka|öka/i.test(lower)) return 'Kalkınma Ajansları';
    if (/sanayi|bakanl[ıi]k|tarım|sa[ğg]l[ıi]k bak/i.test(lower)) return 'Bakanlıklar / Kamu';
    if (/özel|private|sanayi ortak|firma|\.a\.ş|ltd|a\.ş/i.test(lower)) return 'Özel Sektör';
    if (/vakıf|foundation|dern/i.test(lower)) return 'Vakıf / Dernek';
    if (/belirti|unknown|none/i.test(lower)) return 'Belirtilmemiş';
    // Başka bir şey ise orijinal etiketi koru (title-case)
    return raw.trim().replace(/\b\w/g, c => c.toUpperCase());
  }

  async getBudgetUtilization(userId: string, roleName: string) {
    const scope = await this.resolveScope(userId, roleName);
    const qb = this.reportRepo.createQueryBuilder('r')
      .innerJoin('r.project', 'p')
      .select([
        'p.id as "projectId"', 'p.title as title', 'p.budget as budget',
        'p.faculty as faculty', 'p.type as type', 'p.status as status',
        'MAX(r."progressPercent") as progress',
      ])
      .where('r.type = :type', { type: 'financial' });

    if (scope.kind === 'user') {
      const ids = await this.getUserProjectIds(userId);
      if (!ids.length) return [];
      qb.andWhere('p.id IN (:...ids)', { ids });
    } else {
      this.applyScope(qb, 'p', scope);
    }

    return qb.groupBy('p.id, p.title, p.budget, p.faculty, p.type, p.status').getRawMany();
  }

  async getTimeline(
    q: { from?: string; to?: string; year?: string; faculty?: string; type?: string; granularity?: 'month' | 'quarter' | 'year' } = {},
    userId: string,
    roleName: string,
  ) {
    const scope = await this.resolveScope(userId, roleName);

    // Granülerite: month (default, 7 char), quarter (4 char yıl + çeyrek hesap), year (4 char)
    const gran = q.granularity || 'month';
    const dateExpr = gran === 'year'
      ? `SUBSTRING(p."startDate", 1, 4)`
      : gran === 'quarter'
      ? `CONCAT(SUBSTRING(p."startDate", 1, 4), '-Q', CAST(CEIL(CAST(SUBSTRING(p."startDate", 6, 2) AS INT) / 3.0) AS TEXT))`
      : `SUBSTRING(p."startDate", 1, 7)`;

    const qb = this.projectRepo.createQueryBuilder('p')
      .select([
        `${dateExpr} as period`,
        `${dateExpr} as month`,
        'COUNT(*) as count',
        'COUNT(*) as started',
        'SUM(p.budget) as budget',
        `SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completed`,
        `SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) as active`,
        `SUM(CASE WHEN p.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled`,
      ])
      .where('p."startDate" IS NOT NULL');

    if (scope.kind === 'user') {
      const ids = await this.getUserProjectIds(userId);
      if (!ids.length) return [];
      qb.andWhere('p.id IN (:...ids)', { ids });
    } else {
      this.applyScope(qb, 'p', scope);
    }
    this.applyProjectFilters(qb, 'p', q);

    const rows = await qb.groupBy(dateExpr).orderBy('month', 'ASC').getRawMany();
    // Sayisal alanlari string'den number'a cevir (postgres COUNT/SUM string doner)
    return rows.map((r: any) => ({
      period: r.period,
      month: r.month,
      count: +r.count || 0,
      started: +r.started || 0,
      budget: +r.budget || 0,
      completed: +r.completed || 0,
      active: +r.active || 0,
      cancelled: +r.cancelled || 0,
    }));
  }

  async getExportData(q: any, userId: string, roleName: string) {
    const scope = await this.resolveScope(userId, roleName);
    const qb = this.projectRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.owner', 'owner')
      .leftJoinAndSelect('p.members', 'members')
      .leftJoinAndSelect('p.reports', 'reports')
      .orderBy('p.createdAt', 'DESC');

    if (scope.kind === 'user') {
      const ids = await this.getUserProjectIds(userId);
      if (!ids.length) return [];
      qb.where('p.id IN (:...ids)', { ids });
    } else {
      this.applyScope(qb, 'p', scope);
    }

    const projects = await qb.getMany();
    return projects.map(p => ({
      id: p.id, title: p.title, status: p.status, type: p.type,
      faculty: p.faculty, department: p.department, budget: p.budget,
      fundingSource: p.fundingSource, startDate: p.startDate, endDate: p.endDate,
      owner: p.owner ? `${p.owner.firstName} ${p.owner.lastName}` : '-',
      ownerEmail: p.owner?.email || '-',
      memberCount: p.members?.length || 0, reportCount: p.reports?.length || 0,
      latestProgress: p.reports?.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.progressPercent || 0,
      tags: p.tags?.join(', ') || '', createdAt: p.createdAt,
    }));
  }

  /**
   * Yillik raporun ek detaylari: etik durum, IP portfoyu, demografi, ortak ozeti.
   * Tek API cagrisi ile rapor zenginlesir, ekstra round-trip yok.
   */
  async getReportExtras(userId: string, roleName: string) {
    const scope = await this.resolveScope(userId, roleName);

    // Tum projeleri scope ile cek - owner + members + partners (rapor icin tam veri)
    const qb = this.projectRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.partners', 'pr')
      .leftJoinAndSelect('p.owner', 'owner')
      .leftJoinAndSelect('p.members', 'm')
      .leftJoinAndSelect('m.user', 'mu');
    this.applyScope(qb, 'p', scope);
    const projects = await qb.getMany();

    // Etik durumu - genel + fakulte bazli + tur bazli
    const ethicsByFaculty: Record<string, { required: number; approved: number; pending: number }> = {};
    const ethicsByType: Record<string, { required: number; approved: number; pending: number }> = {};
    for (const p of projects) {
      if ((p as any).ethicsRequired) {
        const f = p.faculty || 'Belirtilmemiş';
        const t = p.type || 'other';
        if (!ethicsByFaculty[f]) ethicsByFaculty[f] = { required: 0, approved: 0, pending: 0 };
        if (!ethicsByType[t]) ethicsByType[t] = { required: 0, approved: 0, pending: 0 };
        ethicsByFaculty[f].required++;
        ethicsByType[t].required++;
        if ((p as any).ethicsApproved) {
          ethicsByFaculty[f].approved++;
          ethicsByType[t].approved++;
        } else {
          ethicsByFaculty[f].pending++;
          ethicsByType[t].pending++;
        }
      }
    }
    const ethics = {
      total: projects.length,
      required: projects.filter(p => (p as any).ethicsRequired).length,
      approved: projects.filter(p => (p as any).ethicsApproved).length,
      pending: projects.filter(p => (p as any).ethicsRequired && !(p as any).ethicsApproved).length,
      notRequired: projects.filter(p => !(p as any).ethicsRequired).length,
      // Yeni detaylar
      byFaculty: Object.entries(ethicsByFaculty)
        .map(([faculty, v]) => ({ faculty, ...v, approvalRate: v.required > 0 ? Math.round((v.approved / v.required) * 100) : 0 }))
        .sort((a, b) => b.required - a.required),
      byType: Object.entries(ethicsByType)
        .map(([type, v]) => ({ type, ...v, approvalRate: v.required > 0 ? Math.round((v.approved / v.required) * 100) : 0 }))
        .sort((a, b) => b.required - a.required),
      // Onay bekleyen kritik projeler (en eski 10 - yas riskine gore)
      pendingProjects: projects
        .filter(p => (p as any).ethicsRequired && !(p as any).ethicsApproved)
        .map(p => ({
          id: p.id, title: p.title, faculty: p.faculty, type: p.type,
          owner: p.owner ? `${p.owner.title || ''} ${p.owner.firstName} ${p.owner.lastName}`.trim() : '-',
          createdAt: p.createdAt,
        }))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(0, 10),
    };

    // Fikri Mulkiyet portfoyu - genel + fakulte bazli + detayli liste
    const ipByStatus: Record<string, number> = {};
    const ipByType: Record<string, number> = {};
    const ipByFaculty: Record<string, number> = {};
    const ipDetails: any[] = [];
    let totalIp = 0;
    for (const p of projects) {
      const status = (p as any).ipStatus || 'none';
      if (status !== 'none') {
        totalIp++;
        ipByStatus[status] = (ipByStatus[status] || 0) + 1;
        const type = (p as any).ipType || 'belirtilmemis';
        ipByType[type] = (ipByType[type] || 0) + 1;
        const f = p.faculty || 'Belirtilmemiş';
        ipByFaculty[f] = (ipByFaculty[f] || 0) + 1;
        ipDetails.push({
          id: p.id, title: p.title, faculty: p.faculty,
          ipStatus: status, ipType: type,
          ipRegistrationNo: (p as any).ipRegistrationNo,
          ipDate: (p as any).ipDate,
          owner: p.owner ? `${p.owner.title || ''} ${p.owner.firstName} ${p.owner.lastName}`.trim() : '-',
        });
      }
    }
    const ip = {
      total: totalIp,
      byStatus: Object.entries(ipByStatus).map(([k, v]) => ({ key: k, count: v })).sort((a, b) => b.count - a.count),
      byType: Object.entries(ipByType).map(([k, v]) => ({ key: k, count: v })).sort((a, b) => b.count - a.count),
      byFaculty: Object.entries(ipByFaculty).map(([faculty, count]) => ({ faculty, count })).sort((a, b) => b.count - a.count),
      details: ipDetails.slice(0, 25),
    };

    // Ortak (partner) ozeti
    const partnerSet = new Map<string, { name: string; sector: string; projectCount: number }>();
    for (const p of projects) {
      for (const pr of (p.partners || [])) {
        const key = (pr.name || '').trim().toLowerCase();
        if (!key) continue;
        const existing = partnerSet.get(key);
        if (existing) existing.projectCount++;
        else partnerSet.set(key, { name: pr.name, sector: (pr as any).sector || '-', projectCount: 1 });
      }
    }
    const partnersList = Array.from(partnerSet.values()).sort((a, b) => b.projectCount - a.projectCount);
    const partners = {
      total: partnersList.length,
      totalLinks: partnersList.reduce((s, p) => s + p.projectCount, 0),
      bySector: Object.entries(partnersList.reduce((acc, p) => { acc[p.sector] = (acc[p.sector] || 0) + 1; return acc; }, {} as Record<string, number>))
        .map(([k, v]) => ({ sector: k, count: v }))
        .sort((a, b) => b.count - a.count),
      top: partnersList.slice(0, 15),
    };

    // Demografi - aktif kullanicilarin unvan/rol dagilimi + her unvanin proje istatistikleri
    const userQb = this.userRepo.createQueryBuilder('u').leftJoinAndSelect('u.role', 'r').where('u.isActive = true');
    if (scope.kind === 'faculty') userQb.andWhere('u.faculty = :f', { f: scope.faculty });
    if (scope.kind === 'department') userQb.andWhere('u.department = :d', { d: scope.department });
    const users = await userQb.getMany();

    // Kullanici -> proje sayisi/aktif/tamamlanan/butce hesabi
    // Bir projedeki yurutucu + uyeler katki olarak sayilir
    const userToProjects = new Map<string, { total: number; active: number; completed: number; budget: number }>();
    for (const p of projects) {
      const contributorIds = new Set<string>();
      if (p.owner?.id) contributorIds.add(p.owner.id);
      for (const m of (p.members || [])) if (m.userId) contributorIds.add(m.userId);
      for (const id of contributorIds) {
        if (!userToProjects.has(id)) userToProjects.set(id, { total: 0, active: 0, completed: 0, budget: 0 });
        const acc = userToProjects.get(id)!;
        acc.total++;
        if (p.status === 'active') acc.active++;
        if (p.status === 'completed') acc.completed++;
        acc.budget += (p.budget || 0);
      }
    }

    // Unvan bazli birikim
    const titleStats: Record<string, { count: number; totalProjects: number; activeProjects: number; completedProjects: number; totalBudget: number }> = {};
    for (const u of users) {
      const t = (u.title || 'Belirtilmemiş').trim() || 'Belirtilmemiş';
      if (!titleStats[t]) titleStats[t] = { count: 0, totalProjects: 0, activeProjects: 0, completedProjects: 0, totalBudget: 0 };
      titleStats[t].count++;
      const ups = userToProjects.get(u.id);
      if (ups) {
        titleStats[t].totalProjects += ups.total;
        titleStats[t].activeProjects += ups.active;
        titleStats[t].completedProjects += ups.completed;
        titleStats[t].totalBudget += ups.budget;
      }
    }

    // Rol bazli birikim
    const roleStats: Record<string, { count: number; totalProjects: number }> = {};
    for (const u of users) {
      const rn = u.role?.name || 'Akademisyen';
      if (!roleStats[rn]) roleStats[rn] = { count: 0, totalProjects: 0 };
      roleStats[rn].count++;
      const ups = userToProjects.get(u.id);
      if (ups) roleStats[rn].totalProjects += ups.total;
    }

    // Tur x unvan matrisi - hangi unvanin hangi tur projeyi yaptigi
    const titleTypeMatrix: Record<string, Record<string, number>> = {};
    for (const p of projects) {
      const ownerTitle = (p.owner?.title || 'Belirtilmemiş').trim() || 'Belirtilmemiş';
      const type = p.type || 'other';
      if (!titleTypeMatrix[ownerTitle]) titleTypeMatrix[ownerTitle] = {};
      titleTypeMatrix[ownerTitle][type] = (titleTypeMatrix[ownerTitle][type] || 0) + 1;
    }

    const demographics = {
      totalActive: users.length,
      byTitle: Object.entries(titleStats)
        .map(([title, v]) => ({ title, ...v, avgProjectsPerPerson: v.count > 0 ? Math.round((v.totalProjects / v.count) * 10) / 10 : 0 }))
        .sort((a, b) => b.totalProjects - a.totalProjects),
      byRole: Object.entries(roleStats)
        .map(([role, v]) => ({ role, ...v }))
        .sort((a, b) => b.count - a.count),
      titleTypeMatrix: Object.entries(titleTypeMatrix).map(([title, types]) => ({
        title,
        types: Object.entries(types).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
        totalProjects: Object.values(types).reduce((s, n) => s + n, 0),
      })).sort((a, b) => b.totalProjects - a.totalProjects),
    };

    // Bu yil tamamlanan projeler - artik fakulte/bolum/yurutucu/butce ile
    const currentYear = new Date().getFullYear();
    const completedThisYear = projects
      .filter(p => p.status === 'completed' && p.endDate && p.endDate.startsWith(String(currentYear)))
      .map(p => ({
        id: p.id, title: p.title, faculty: p.faculty, department: p.department, type: p.type,
        budget: p.budget, endDate: p.endDate,
        owner: p.owner ? `${p.owner.title || ''} ${p.owner.firstName} ${p.owner.lastName}`.trim() : '-',
        memberCount: (p.members || []).length,
      }))
      .sort((a, b) => (b.budget || 0) - (a.budget || 0))
      .slice(0, 20);

    return {
      ethics,
      ip,
      partners,
      demographics,
      completedThisYear,
      scope: scope.kind,
    };
  }
}
