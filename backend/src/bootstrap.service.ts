import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Permission } from './database/entities/permission.entity';
import { Role } from './database/entities/role.entity';
import { Project } from './database/entities/project.entity';
import { User } from './database/entities/user.entity';
import { SystemSetting } from './database/entities/system-setting.entity';
import { DEMO_PROJECTS } from './database/demo-projects';

const REQUIRED_PERMISSIONS = [
  { name: 'ethics:read',   module: 'ethics', action: 'read',   description: 'Etik kurul başvurularını görüntüle' },
  { name: 'ethics:manage', module: 'ethics', action: 'manage', description: 'Etik kurul kararı ver (onayla/reddet)' },
];

const RECTOR_PERMS = [
  'projects:read', 'analytics:read', 'ethics:read', 'ethics:manage',
];

@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    @InjectRepository(Permission) private permRepo: Repository<Permission>,
    @InjectRepository(Role)       private roleRepo: Repository<Role>,
    @InjectRepository(Project)    private projectRepo: Repository<Project>,
    @InjectRepository(User)       private userRepo: Repository<User>,
    @InjectRepository(SystemSetting) private settingRepo: Repository<SystemSetting>,
  ) {}

  async onApplicationBootstrap() {
    try {
      // 1. Eksik yetkileri oluştur
      const savedPerms: Permission[] = [];
      for (const p of REQUIRED_PERMISSIONS) {
        let perm = await this.permRepo.findOne({ where: { name: p.name } });
        if (!perm) perm = await this.permRepo.save(this.permRepo.create(p));
        savedPerms.push(perm);
      }

      // 2. Süper Admin'e yeni yetkileri ekle
      const superAdmin = await this.roleRepo.findOne({
        where: { name: 'Süper Admin' },
        relations: ['permissions'],
      });
      if (superAdmin) {
        const existing = superAdmin.permissions.map(p => p.name);
        const toAdd = savedPerms.filter(p => !existing.includes(p.name));
        if (toAdd.length > 0) {
          superAdmin.permissions = [...superAdmin.permissions, ...toAdd];
          await this.roleRepo.save(superAdmin);
        }
      }

      // 3. Dekan rolüne ethics:read ekle
      const dekan = await this.roleRepo.findOne({
        where: { name: 'Dekan' },
        relations: ['permissions'],
      });
      if (dekan) {
        const existing = dekan.permissions.map(p => p.name);
        const ethicsRead = savedPerms.find(p => p.name === 'ethics:read');
        if (ethicsRead && !existing.includes('ethics:read')) {
          dekan.permissions = [...dekan.permissions, ethicsRead];
          await this.roleRepo.save(dekan);
        }
      }

      // 4. Rektör rolü yoksa oluştur
      let rector = await this.roleRepo.findOne({
        where: { name: 'Rektör' },
        relations: ['permissions'],
      });
      if (!rector) {
        const allPerms = await this.permRepo.find({ where: { name: In(RECTOR_PERMS) } });
        rector = this.roleRepo.create({
          name: 'Rektör',
          description: 'Üniversite rektörü — tüm projeleri ve etik kurulu yönetir',
          isSystem: true,
          permissions: allPerms,
        });
        await this.roleRepo.save(rector);
      }
    } catch (e) {
      // Bootstrap hataları uygulamayı durdurmasin
      console.warn('[Bootstrap] Yetki/rol oluşturma hatası:', e?.message);
    }

    // 5. Eksik sistem ayarlarını idempotent olarak oluştur
    await this.seedMissingSettings();

    // 6. Demo projeleri idempotent seed — SEED_DEMO_PROJECTS=false ile kapatılabilir
    if (process.env.SEED_DEMO_PROJECTS !== 'false') {
      await this.seedDemoProjects();
    }
  }

  /**
   * Yeni sistem ayarı eklendiğinde (yeni kurum adı, rektör adı vb.)
   * mevcut DB'de olmayan anahtarları oluştur. Var olanlara dokunma —
   * admin tarafından değiştirilen değerler korunmalı.
   */
  private async seedMissingSettings() {
    const required = [
      { key: 'institution_name', value: 'Hatay Mustafa Kemal Üniversitesi', label: 'Kurum Adı (Raporlar için)', type: 'text' },
      { key: 'rector_name',      value: 'Prof. Dr. Veysel EREN',            label: 'Rektör Adı',                 type: 'text' },
    ];
    for (const r of required) {
      const ex = await this.settingRepo.findOne({ where: { key: r.key } });
      if (!ex) {
        try {
          await this.settingRepo.save(this.settingRepo.create(r));
          this.logger.log(`[Settings] Eksik ayar eklendi: ${r.key}`);
        } catch (e: any) {
          this.logger.warn(`[Settings] ${r.key} eklenemedi: ${e.message}`);
        }
      }
    }
  }

  /**
   * Demo projeleri sisteme ekler — mevcut olanları atlar. Her başlangıçta
   * çalışır, sadece ilk kezinde gerçek iş yapar. SEED_DEMO_PROJECTS=false ile
   * tamamen kapatılabilir.
   */
  private async seedDemoProjects() {
    try {
      // Admin kullanıcıyı bul — default owner olarak kullanacağız
      const admin = await this.userRepo.findOne({ where: { email: 'admin@mku.edu.tr' } });
      const allUsers = await this.userRepo.find();
      const byEmail: Record<string, User> = {};
      for (const u of allUsers) byEmail[u.email] = u;

      const defaultOwner = admin?.id || allUsers[0]?.id;
      if (!defaultOwner) {
        this.logger.warn('[Demo Seed] Sistemde kullanıcı yok — demo projeler atlandı');
        return;
      }

      let inserted = 0;
      for (const pd of DEMO_PROJECTS) {
        const exists = await this.projectRepo.findOne({ where: { title: pd.title } });
        if (exists) continue;

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
        proj.ownerId = ownerId;
        proj.tags = pd.tags || [];
        if (pd.keywords) proj.keywords = pd.keywords;
        if (pd.sdgGoals) proj.sdgGoals = pd.sdgGoals;
        if (pd.ethicsRequired) (proj as any).ethicsRequired = pd.ethicsRequired;
        if (pd.ethicsApproved) (proj as any).ethicsApproved = pd.ethicsApproved;
        if (pd.ipStatus) (proj as any).ipStatus = pd.ipStatus;

        await this.projectRepo.save(proj);
        inserted++;
      }

      if (inserted > 0) {
        this.logger.log(`[Demo Seed] ${inserted} demo proje eklendi (${DEMO_PROJECTS.length - inserted} zaten mevcuttu)`);
      }
    } catch (e: any) {
      this.logger.warn(`[Demo Seed] Hata: ${e.message}`);
    }
  }
}
