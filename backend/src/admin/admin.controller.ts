import { Controller, Post, Delete, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';
import { DEMO_PROJECTS } from '../database/demo-projects';

/**
 * Admin yardımcı endpoint'leri - Railway shell olmadığı için DB bakımını
 * tarayıcıdan yapabilmek için.
 */
@SkipThrottle()
@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  /**
   * POST /api/admin/seed-demo
   * Süper Admin olarak çağrılır. Demo projeleri idempotent ekler
   * (aynı başlık varsa atlar). Fakülteler, roller ve kullanıcılar
   * zaten bootstrap/seed tarafından oluşturulmuş varsayılır.
   */
  @Post('seed-demo')
  async seedDemo(@Request() req: any) {
    const roleName = req.user?.roleName || '';
    if (roleName !== 'Süper Admin') {
      throw new ForbiddenException('Bu işlem için Süper Admin yetkisi gereklidir');
    }
    // PRODUCTION'DA DEMO VERI YASAK - kullanici tercihi
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_DATA !== 'true') {
      throw new ForbiddenException('Demo veri ekleme production ortamında devre dışıdır. Aktiflestirmek icin ALLOW_DEMO_DATA=true env degiskeni set edin (onerilmez).');
    }

    // Varsayılan owner: istek atan admin
    const adminUser = await this.userRepo.findOne({ where: { id: req.user.userId } });
    const defaultOwner = adminUser?.id;

    // Email → user map
    const allUsers = await this.userRepo.find();
    const byEmail: Record<string, User> = {};
    for (const u of allUsers) byEmail[u.email] = u;

    let inserted = 0;
    let skipped = 0;
    const insertedTitles: string[] = [];

    for (const pd of DEMO_PROJECTS) {
      const exists = await this.projectRepo.findOne({ where: { title: pd.title } });
      if (exists) { skipped++; continue; }

      const ownerId = (pd.ownerEmail && byEmail[pd.ownerEmail]?.id) || defaultOwner;

      const proj = new Project();
      proj.title = pd.title;
      proj.description = pd.description;
      if (pd.projectText) (proj as any).projectText = pd.projectText;
      proj.type = pd.type;
      proj.status = pd.status;
      proj.faculty = pd.faculty;
      proj.department = pd.department;
      proj.budget = pd.budget;
      proj.fundingSource = pd.fundingSource;
      proj.startDate = pd.startDate;
      proj.endDate = pd.endDate;
      proj.ownerId = ownerId!;
      proj.tags = pd.tags || [];
      if (pd.keywords) proj.keywords = pd.keywords;
      if (pd.sdgGoals) proj.sdgGoals = pd.sdgGoals;
      if (pd.ethicsRequired) (proj as any).ethicsRequired = pd.ethicsRequired;
      if (pd.ethicsApproved) (proj as any).ethicsApproved = pd.ethicsApproved;
      if (pd.ipStatus) (proj as any).ipStatus = pd.ipStatus;

      await this.projectRepo.save(proj);
      inserted++;
      insertedTitles.push(pd.title);
    }

    return {
      success: true,
      total: DEMO_PROJECTS.length,
      inserted,
      skipped,
      insertedTitles,
      message: inserted > 0
        ? `${inserted} demo proje eklendi (${skipped} zaten mevcuttu).`
        : `Tüm demo projeler zaten mevcut (${skipped} proje).`,
    };
  }

  /**
   * DELETE /api/admin/demo-projects
   * DEMO_PROJECTS listesindeki başlıklarla eşleşen tüm projeleri siler.
   * İlişkili kayıtları (üye/belge/rapor/partner/etik inceleme) da temizler.
   * Süper Admin yetkisi gerekir.
   */
  @Delete('demo-projects')
  async deleteDemoProjects(@Request() req: any) {
    const roleName = req.user?.roleName || '';
    if (roleName !== 'Süper Admin') {
      throw new ForbiddenException('Bu işlem için Süper Admin yetkisi gereklidir');
    }

    const demoTitles = DEMO_PROJECTS.map(p => p.title);
    const existing = await this.projectRepo.find({ where: { title: In(demoTitles) } });
    const deletedTitles: string[] = [];

    for (const p of existing) {
      try {
        await this.projectRepo.manager.query('DELETE FROM project_members WHERE "projectId" = $1', [p.id]).catch(() => {});
        await this.projectRepo.manager.query('DELETE FROM project_documents WHERE "projectId" = $1', [p.id]).catch(() => {});
        await this.projectRepo.manager.query('DELETE FROM project_reports WHERE "projectId" = $1', [p.id]).catch(() => {});
        await this.projectRepo.manager.query('DELETE FROM project_partners WHERE "projectId" = $1', [p.id]).catch(() => {});
        await this.projectRepo.manager.query('DELETE FROM ethics_reviews WHERE "projectId" = $1', [p.id]).catch(() => {});
        await this.projectRepo.delete(p.id);
        deletedTitles.push(p.title);
      } catch {}
    }

    return {
      success: true,
      deleted: deletedTitles.length,
      deletedTitles,
      message: `${deletedTitles.length} demo proje silindi.`,
    };
  }
}
