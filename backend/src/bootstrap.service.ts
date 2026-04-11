import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Permission } from './database/entities/permission.entity';
import { Role } from './database/entities/role.entity';

const REQUIRED_PERMISSIONS = [
  { name: 'ethics:read',   module: 'ethics', action: 'read',   description: 'Etik kurul başvurularını görüntüle' },
  { name: 'ethics:manage', module: 'ethics', action: 'manage', description: 'Etik kurul kararı ver (onayla/reddet)' },
];

const RECTOR_PERMS = [
  'projects:read', 'analytics:read', 'ethics:read', 'ethics:manage',
];

@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(Permission) private permRepo: Repository<Permission>,
    @InjectRepository(Role)       private roleRepo: Repository<Role>,
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
  }
}
