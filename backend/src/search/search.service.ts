import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';
import { ProjectDocument } from '../database/entities/project-document.entity';

export interface GlobalSearchResult {
  projects: Array<{ id: string; title: string; type: string; status: string; faculty?: string; snippet?: string }>;
  users: Array<{ id: string; name: string; email: string; faculty?: string; role?: string }>;
  documents: Array<{ id: string; name: string; projectId: string; projectTitle?: string }>;
  totals: { projects: number; users: number; documents: number };
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Project)        private projectRepo: Repository<Project>,
    @InjectRepository(User)           private userRepo: Repository<User>,
    @InjectRepository(ProjectDocument) private docRepo: Repository<ProjectDocument>,
  ) {}

  async globalSearch(query: string, limit = 5): Promise<GlobalSearchResult> {
    const q = query.trim();
    if (!q || q.length < 2) {
      return { projects: [], users: [], documents: [], totals: { projects: 0, users: 0, documents: 0 } };
    }
    const like = `%${q}%`;

    const [projects, projectsTotal, users, usersTotal, docs, docsTotal] = await Promise.all([
      this.projectRepo.createQueryBuilder('p')
        .where('p.title ILIKE :q OR p.description ILIKE :q', { q: like })
        .orderBy('p.createdAt', 'DESC')
        .take(limit)
        .getMany(),
      this.projectRepo.createQueryBuilder('p')
        .where('p.title ILIKE :q OR p.description ILIKE :q', { q: like })
        .getCount(),
      this.userRepo.createQueryBuilder('u')
        .leftJoinAndSelect('u.role', 'role')
        .where('u."firstName" ILIKE :q OR u."lastName" ILIKE :q OR u.email ILIKE :q', { q: like })
        .andWhere('u.isActive = true')
        .take(limit)
        .getMany(),
      this.userRepo.createQueryBuilder('u')
        .where('u."firstName" ILIKE :q OR u."lastName" ILIKE :q OR u.email ILIKE :q', { q: like })
        .andWhere('u.isActive = true')
        .getCount(),
      this.docRepo.createQueryBuilder('d')
        .leftJoinAndSelect('d.project', 'project')
        .where('d.name ILIKE :q', { q: like })
        .take(limit)
        .getMany(),
      this.docRepo.createQueryBuilder('d').where('d.name ILIKE :q', { q: like }).getCount(),
    ]);

    return {
      projects: projects.map(p => ({
        id: p.id, title: p.title, type: p.type, status: p.status, faculty: p.faculty,
        snippet: (p.description || '').slice(0, 120),
      })),
      users: users.map(u => ({
        id: u.id,
        name: `${u.title || ''} ${u.firstName} ${u.lastName}`.trim(),
        email: u.email,
        faculty: u.faculty,
        role: u.role?.name,
      })),
      documents: docs.map(d => ({
        id: d.id, name: d.name,
        projectId: d.projectId,
        projectTitle: d.project?.title,
      })),
      totals: { projects: projectsTotal, users: usersTotal, documents: docsTotal },
    };
  }
}
