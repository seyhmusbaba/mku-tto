import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../database/entities/project.entity';
import { ProjectMember } from '../database/entities/project-member.entity';
import { User } from '../database/entities/user.entity';

/**
 * Kurumsal karşılaştırma analitiği.
 * Rektör / dekan / admin panelleri için agrega görünümler:
 *  - Fakülte Radar  (6-boyutlu karşılaştırma)
 *  - Cross-Fakülte İşbirlik Matrisi
 *  - SDG × Fakülte Isı Haritası
 */

export interface FacultyRadarRow {
  faculty: string;
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalBudget: number;
  avgBudget: number;
  successRate: number;      // % tamamlanan (karara bağlanmış üstünden)
  sdgCoverage: number;      // farklı SDG sayısı
  ipCount: number;          // patent/tescil kaydı olan proje sayısı
  ethicsApprovedCount: number;
  memberTotal: number;      // benzersiz üye sayısı
  // Normalized 0-100 değerler (radar için)
  normalized?: {
    projectScale: number;
    budgetScale: number;
    successScore: number;
    sdgScore: number;
    ipScore: number;
    ethicsScore: number;
  };
}

export interface CollaborationCell {
  facultyA: string;
  facultyB: string;
  sharedProjects: number;
  projectIds: string[];
  projects?: Array<{ id: string; name: string; code?: string; status?: string }>;
}

export interface SdgHeatmapCell {
  faculty: string;
  sdgCode: string;
  count: number;
  projectIds?: string[];
  projects?: Array<{ id: string; name: string; code?: string; status?: string }>;
}

@Injectable()
export class InstitutionalService {
  constructor(
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(ProjectMember) private memberRepo: Repository<ProjectMember>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  /**
   * 6-boyutlu fakülte radar karşılaştırması.
   * Radar eksenleri: Proje Ölçeği, Bütçe, Başarı, SDG Kapsamı, IP, Etik Onay
   */
  async getFacultyRadar(): Promise<FacultyRadarRow[]> {
    // Fakülte bazlı agrega
    const rows = await this.projectRepo.createQueryBuilder('p')
      .select([
        'p.faculty as faculty',
        'COUNT(*)::int as "totalProjects"',
        `SUM(CASE WHEN p.status = 'active'    THEN 1 ELSE 0 END)::int as "activeProjects"`,
        `SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END)::int as "completedProjects"`,
        `SUM(CASE WHEN p.status = 'cancelled' THEN 1 ELSE 0 END)::int as "cancelledProjects"`,
        'COALESCE(SUM(p.budget), 0)::bigint as "totalBudget"',
        `COUNT(CASE WHEN p."ipStatus" IS NOT NULL AND p."ipStatus" != 'none' THEN 1 END)::int as "ipCount"`,
        `COUNT(CASE WHEN p."ethicsApproved" = true THEN 1 END)::int as "ethicsApprovedCount"`,
      ])
      .where('p.faculty IS NOT NULL AND p.faculty != \'\'')
      .groupBy('p.faculty')
      .getRawMany();

    // Her fakülte için ek sorgular — SDG çeşitliliği ve üye sayısı
    const result: FacultyRadarRow[] = [];
    for (const r of rows) {
      const faculty = r.faculty;
      const sdgCoverage = await this.countSdgCoverage(faculty);
      const memberTotal = await this.countUniqueMembers(faculty);
      const totalBudget = Number(r.totalBudget) || 0;
      const completed = +r.completedProjects;
      const cancelled = +r.cancelledProjects;
      const decided = completed + cancelled;
      const successRate = decided > 0 ? Math.round((completed / decided) * 100) : 0;

      result.push({
        faculty,
        totalProjects: +r.totalProjects,
        activeProjects: +r.activeProjects,
        completedProjects: completed,
        totalBudget,
        avgBudget: +r.totalProjects > 0 ? Math.round(totalBudget / +r.totalProjects) : 0,
        successRate,
        sdgCoverage,
        ipCount: +r.ipCount,
        ethicsApprovedCount: +r.ethicsApprovedCount,
        memberTotal,
      });
    }

    // 0-100 normalize et — radar chart'ı düzgün göstersin
    const maxProjects = Math.max(...result.map(r => r.totalProjects), 1);
    const maxBudget = Math.max(...result.map(r => r.totalBudget), 1);
    const maxSdg = 17;
    const maxIp = Math.max(...result.map(r => r.ipCount), 1);
    const maxEthics = Math.max(...result.map(r => r.ethicsApprovedCount), 1);

    for (const r of result) {
      r.normalized = {
        projectScale: Math.round((r.totalProjects / maxProjects) * 100),
        budgetScale:  Math.round((r.totalBudget   / maxBudget)   * 100),
        successScore: r.successRate,
        sdgScore:     Math.round((r.sdgCoverage   / maxSdg)      * 100),
        ipScore:      Math.round((r.ipCount       / maxIp)       * 100),
        ethicsScore:  Math.round((r.ethicsApprovedCount / maxEthics) * 100),
      };
    }

    return result.sort((a, b) => b.totalProjects - a.totalProjects);
  }

  private async countSdgCoverage(faculty: string): Promise<number> {
    // Her projenin sdgGoalsJson'unu çek, tüm SDG'leri union'la say
    const projects = await this.projectRepo.find({
      where: { faculty } as any,
      select: ['id'],
    });
    if (!projects.length) return 0;

    const raw = await this.projectRepo
      .createQueryBuilder('p')
      .select('p."sdgGoalsJson"', 'sdg')
      .where('p.faculty = :f', { f: faculty })
      .andWhere('p."sdgGoalsJson" IS NOT NULL')
      .getRawMany();

    const set = new Set<string>();
    for (const r of raw) {
      try {
        const arr = JSON.parse(r.sdg) as string[];
        for (const g of arr) if (g) set.add(g);
      } catch {}
    }
    return set.size;
  }

  private async countUniqueMembers(faculty: string): Promise<number> {
    const raw = await this.memberRepo
      .createQueryBuilder('m')
      .innerJoin('m.project', 'p')
      .select('COUNT(DISTINCT m."userId")::int', 'count')
      .where('p.faculty = :f', { f: faculty })
      .getRawOne();
    return +(raw?.count || 0);
  }

  /**
   * Cross-fakülte işbirlik matrisi.
   * Aynı projede farklı fakültelerden üyeler varsa, o fakülteler arasında +1 bağ.
   * User.faculty ile ProjectMember.user üzerinden hesaplanır.
   */
  async getCollaborationMatrix(): Promise<{ faculties: string[]; cells: CollaborationCell[] }> {
    // Her proje için katılan fakülteler (owner + members)
    const projects = await this.projectRepo.find({
      relations: ['owner', 'members', 'members.user'],
    });

    // Proje lookup (id → özet bilgi)
    const projectLookup = new Map<string, { id: string; name: string; code?: string; status?: string }>();
    for (const p of projects) {
      projectLookup.set(p.id, {
        id: p.id,
        name: p.title || '(İsimsiz proje)',
        status: p.status,
      });
    }

    const facultySet = new Set<string>();
    const pairMap = new Map<string, { facultyA: string; facultyB: string; projectIds: Set<string> }>();

    for (const p of projects) {
      if (!p.faculty) continue;
      const facultiesInProject = new Set<string>();
      facultiesInProject.add(p.faculty);
      if (p.owner?.faculty) facultiesInProject.add(p.owner.faculty);
      for (const m of p.members || []) {
        if (m.user?.faculty) facultiesInProject.add(m.user.faculty);
      }

      const arr = Array.from(facultiesInProject);
      for (const f of arr) facultySet.add(f);

      if (arr.length < 2) continue;

      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const [a, b] = [arr[i], arr[j]].sort();
          const key = `${a}||${b}`;
          const cur = pairMap.get(key);
          if (cur) {
            cur.projectIds.add(p.id);
          } else {
            pairMap.set(key, { facultyA: a, facultyB: b, projectIds: new Set([p.id]) });
          }
        }
      }
    }

    const cells: CollaborationCell[] = Array.from(pairMap.values())
      .map(p => {
        const ids = Array.from(p.projectIds);
        return {
          facultyA: p.facultyA,
          facultyB: p.facultyB,
          sharedProjects: ids.length,
          projectIds: ids,
          projects: ids.map(id => projectLookup.get(id)).filter(Boolean) as any[],
        };
      })
      .sort((a, b) => b.sharedProjects - a.sharedProjects);

    return {
      faculties: Array.from(facultySet).sort(),
      cells,
    };
  }

  /**
   * SDG × Fakülte ısı haritası.
   */
  async getSdgHeatmap(): Promise<{ faculties: string[]; sdgs: string[]; cells: SdgHeatmapCell[] }> {
    const raw = await this.projectRepo
      .createQueryBuilder('p')
      .select(['p.id as id', 'p.title as title', 'p.status as status', 'p.faculty as faculty', 'p."sdgGoalsJson" as sdg'])
      .where('p.faculty IS NOT NULL AND p.faculty != \'\'')
      .andWhere('p."sdgGoalsJson" IS NOT NULL')
      .getRawMany();

    const facultySet = new Set<string>();
    const sdgSet = new Set<string>();
    const cellMap = new Map<string, { faculty: string; sdgCode: string; projects: Array<{ id: string; name: string; code?: string; status?: string }> }>();

    for (const r of raw) {
      const faculty = r.faculty;
      facultySet.add(faculty);
      try {
        const arr = JSON.parse(r.sdg) as string[];
        for (const s of arr) {
          if (!s) continue;
          sdgSet.add(s);
          const key = `${faculty}||${s}`;
          const cur = cellMap.get(key);
          const proj = { id: r.id, name: r.title || '(İsimsiz)', status: r.status };
          if (cur) {
            cur.projects.push(proj);
          } else {
            cellMap.set(key, { faculty, sdgCode: s, projects: [proj] });
          }
        }
      } catch {}
    }

    const cells: SdgHeatmapCell[] = Array.from(cellMap.values()).map(c => ({
      faculty: c.faculty,
      sdgCode: c.sdgCode,
      count: c.projects.length,
      projectIds: c.projects.map(p => p.id),
      projects: c.projects,
    }));

    const sdgs = Array.from(sdgSet).sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] || '99');
      const nb = parseInt(b.match(/\d+/)?.[0] || '99');
      return na - nb;
    });

    return {
      faculties: Array.from(facultySet).sort(),
      sdgs,
      cells,
    };
  }
}
