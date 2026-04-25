import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';
import { ProjectDocument } from '../database/entities/project-document.entity';
import { Competition } from '../database/entities/competition.entity';
import { ProjectPartner } from '../database/entities/project-partner.entity';
import { Publication } from '../database/entities/publication.entity';

export interface SearchFilters {
  scope?: string;              // all|projects|users|documents|competitions|partners|publications
  type?: string;
  status?: string;
  faculty?: string;
  yearFrom?: number;
  yearTo?: number;
  limit?: number;
}

export interface GlobalSearchResult {
  projects: any[];
  users: any[];
  documents: any[];
  competitions: any[];
  partners: any[];
  publications: any[];
  totals: Record<string, number>;
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Project)         private projectRepo: Repository<Project>,
    @InjectRepository(User)            private userRepo: Repository<User>,
    @InjectRepository(ProjectDocument) private docRepo: Repository<ProjectDocument>,
    @InjectRepository(Competition)     private compRepo: Repository<Competition>,
    @InjectRepository(ProjectPartner)  private partnerRepo: Repository<ProjectPartner>,
    @InjectRepository(Publication)     private pubRepo: Repository<Publication>,
  ) {}

  async globalSearch(query: string, filters: SearchFilters = {}): Promise<GlobalSearchResult> {
    const q = (query || '').trim();
    const empty: GlobalSearchResult = {
      projects: [], users: [], documents: [], competitions: [],
      partners: [], publications: [],
      totals: { projects: 0, users: 0, documents: 0, competitions: 0, partners: 0, publications: 0 },
    };
    if (!q || q.length < 2) return empty;

    const like = `%${q}%`;
    const limit = Math.min(Math.max(filters.limit || 8, 1), 25);
    const scope = filters.scope || 'all';
    const want = (s: string) => scope === 'all' || scope === s;

    const tasks: Promise<any>[] = [];

    // Projects
    if (want('projects')) {
      tasks.push(this.searchProjects(like, filters, limit));
    } else tasks.push(Promise.resolve({ items: [], total: 0 }));

    // Users
    if (want('users')) {
      tasks.push(this.searchUsers(like, filters, limit));
    } else tasks.push(Promise.resolve({ items: [], total: 0 }));

    // Documents
    if (want('documents')) {
      tasks.push(this.searchDocuments(like, limit));
    } else tasks.push(Promise.resolve({ items: [], total: 0 }));

    // Competitions
    if (want('competitions')) {
      tasks.push(this.searchCompetitions(like, filters, limit));
    } else tasks.push(Promise.resolve({ items: [], total: 0 }));

    // Partners
    if (want('partners')) {
      tasks.push(this.searchPartners(like, limit));
    } else tasks.push(Promise.resolve({ items: [], total: 0 }));

    // Publications
    if (want('publications')) {
      tasks.push(this.searchPublications(like, filters, limit));
    } else tasks.push(Promise.resolve({ items: [], total: 0 }));

    const [projRes, userRes, docRes, compRes, partRes, pubRes] = await Promise.all(tasks);

    return {
      projects: projRes.items,
      users: userRes.items,
      documents: docRes.items,
      competitions: compRes.items,
      partners: partRes.items,
      publications: pubRes.items,
      totals: {
        projects: projRes.total,
        users: userRes.total,
        documents: docRes.total,
        competitions: compRes.total,
        partners: partRes.total,
        publications: pubRes.total,
      },
    };
  }

  // ── Projects ───────────────────────────────────────────────
  private async searchProjects(like: string, f: SearchFilters, limit: number) {
    const qb = this.projectRepo.createQueryBuilder('p')
      .where('(p.title ILIKE :q OR p.description ILIKE :q)', { q: like });
    if (f.type) qb.andWhere('p.type = :t', { t: f.type });
    if (f.status) qb.andWhere('p.status = :s', { s: f.status });
    if (f.faculty) qb.andWhere('p.faculty = :f', { f: f.faculty });
    // startDate ISO string formatında (YYYY-MM-DD) - substring ile yıl filtrele
    if (f.yearFrom) qb.andWhere('SUBSTRING(p."startDate", 1, 4) >= :yf', { yf: String(f.yearFrom) });
    if (f.yearTo) qb.andWhere('SUBSTRING(p."startDate", 1, 4) <= :yt', { yt: String(f.yearTo) });

    const [items, total] = await Promise.all([
      qb.clone().orderBy('p.createdAt', 'DESC').take(limit).getMany(),
      qb.getCount(),
    ]);
    return {
      items: items.map(p => ({
        id: p.id, title: p.title, type: p.type, status: p.status,
        faculty: p.faculty, startDate: p.startDate, endDate: p.endDate,
        snippet: (p.description || '').slice(0, 140),
      })),
      total,
    };
  }

  // ── Users ──────────────────────────────────────────────────
  private async searchUsers(like: string, f: SearchFilters, limit: number) {
    const qb = this.userRepo.createQueryBuilder('u')
      .leftJoinAndSelect('u.role', 'role')
      .where('(u."firstName" ILIKE :q OR u."lastName" ILIKE :q OR u.email ILIKE :q OR u.department ILIKE :q)', { q: like })
      .andWhere('u.isActive = true');
    if (f.faculty) qb.andWhere('u.faculty = :f', { f: f.faculty });

    const [items, total] = await Promise.all([
      qb.clone().take(limit).getMany(),
      qb.getCount(),
    ]);
    return {
      items: items.map(u => ({
        id: u.id,
        name: `${u.title || ''} ${u.firstName} ${u.lastName}`.trim(),
        email: u.email,
        faculty: u.faculty,
        department: (u as any).department,
        role: u.role?.name,
      })),
      total,
    };
  }

  // ── Documents ──────────────────────────────────────────────
  private async searchDocuments(like: string, limit: number) {
    const qb = this.docRepo.createQueryBuilder('d')
      .leftJoinAndSelect('d.project', 'project')
      .where('d.name ILIKE :q', { q: like });
    const [items, total] = await Promise.all([
      qb.clone().take(limit).getMany(),
      qb.getCount(),
    ]);
    return {
      items: items.map(d => ({
        id: d.id, name: d.name,
        projectId: d.projectId,
        projectTitle: d.project?.title,
        createdAt: (d as any).createdAt,
      })),
      total,
    };
  }

  // ── Competitions ───────────────────────────────────────────
  private async searchCompetitions(like: string, f: SearchFilters, limit: number) {
    const qb = this.compRepo.createQueryBuilder('c')
      .where('(c.title ILIKE :q OR c.description ILIKE :q OR c.source ILIKE :q OR c.category ILIKE :q)', { q: like });
    if (f.type) qb.andWhere('c.source = :t', { t: f.type });
    if (f.status) qb.andWhere('c.status = :s', { s: f.status });

    const [items, total] = await Promise.all([
      qb.clone().orderBy('c.deadline', 'ASC').take(limit).getMany(),
      qb.getCount(),
    ]);
    return {
      items: items.map(c => ({
        id: c.id, title: c.title, organizer: c.source, type: c.source,
        category: c.category, deadline: c.deadline, status: c.status,
        budget: c.budget,
        snippet: (c.description || '').slice(0, 140),
      })),
      total,
    };
  }

  // ── Partners ───────────────────────────────────────────────
  private async searchPartners(like: string, limit: number) {
    const qb = this.partnerRepo.createQueryBuilder('p')
      .where('(p.name ILIKE :q OR p.contactName ILIKE :q OR p.contactEmail ILIKE :q OR p.sector ILIKE :q)', { q: like });

    const [items, total] = await Promise.all([
      qb.clone().take(limit).getMany(),
      qb.getCount(),
    ]);
    return {
      items: items.map(p => ({
        id: p.id, name: p.name, role: p.role, projectId: p.projectId,
        contactPerson: (p as any).contactName, contactEmail: p.contactEmail,
        sector: (p as any).sector, tier: (p as any).tier,
      })),
      total,
    };
  }

  // ── Publications (manual uploads) ─────────────────────────
  private async searchPublications(like: string, f: SearchFilters, limit: number) {
    const qb = this.pubRepo.createQueryBuilder('x')
      .where('(x.title ILIKE :q OR x.authors ILIKE :q OR x.journal ILIKE :q OR x.doi ILIKE :q)', { q: like });
    if (f.yearFrom) qb.andWhere('x.year >= :yf', { yf: f.yearFrom });
    if (f.yearTo) qb.andWhere('x.year <= :yt', { yt: f.yearTo });
    if (f.type) qb.andWhere('x.type = :t', { t: f.type });

    const [items, total] = await Promise.all([
      qb.clone().orderBy('x.year', 'DESC').take(limit).getMany(),
      qb.getCount(),
    ]);
    return {
      items: items.map(x => ({
        id: x.id, title: x.title, authors: x.authors, journal: x.journal,
        year: x.year, doi: x.doi, url: x.url, type: x.type,
        citations: x.citations, quartile: x.quartile, isFeatured: x.isFeatured,
      })),
      total,
    };
  }

  // ── Suggestions - lightweight autocomplete ────────────────
  async suggest(query: string, limit = 5): Promise<string[]> {
    const q = (query || '').trim();
    if (q.length < 2) return [];
    const like = `%${q}%`;
    const [projects, users, competitions, partners] = await Promise.all([
      this.projectRepo.createQueryBuilder('p')
        .select('p.title', 'v')
        .where('p.title ILIKE :q', { q: like })
        .take(limit).getRawMany(),
      this.userRepo.createQueryBuilder('u')
        .select('COALESCE(u."firstName", \'\') || \' \' || COALESCE(u."lastName", \'\')', 'v')
        .where('u."firstName" ILIKE :q OR u."lastName" ILIKE :q', { q: like })
        .andWhere('u.isActive = true')
        .take(limit).getRawMany(),
      this.compRepo.createQueryBuilder('c')
        .select('c.title', 'v')
        .where('c.title ILIKE :q', { q: like })
        .take(limit).getRawMany(),
      this.partnerRepo.createQueryBuilder('p')
        .select('p.name', 'v')
        .where('p.name ILIKE :q', { q: like })
        .take(limit).getRawMany(),
    ]);

    const set = new Set<string>();
    for (const r of [...projects, ...users, ...competitions, ...partners]) {
      const v = String(r.v || '').trim();
      if (v.length >= 2) set.add(v);
      if (set.size >= limit * 2) break;
    }
    return Array.from(set).slice(0, limit * 2);
  }
}
