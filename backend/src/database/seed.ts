import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { join } from 'path';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { SystemSetting } from './entities/system-setting.entity';
import { Project } from './entities/project.entity';
import { ProjectMember } from './entities/project-member.entity';
import { ProjectDocument } from './entities/project-document.entity';
import { ProjectType } from './entities/project-type.entity';
import { Faculty } from './entities/faculty.entity';
import { Notification } from './entities/notification.entity';
import { ReportType } from './entities/report-type.entity';
import { ProjectReport } from './entities/project-report.entity';
import { DynamicProjectField } from './entities/dynamic-project-field.entity';
import { ProjectPartner } from './entities/project-partner.entity';

// .env dosyasından DATABASE_URL okur
import * as dotenv from 'dotenv';
dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  entities: [User, Role, Permission, SystemSetting, Project, ProjectMember, ProjectDocument, ProjectReport, DynamicProjectField, ProjectType, Faculty, Notification, ReportType, ProjectPartner],
  synchronize: true,
});

async function seed() {
  await AppDataSource.initialize();
  console.log('🌱 Veritabanı hazırlanıyor...');

  const permRepo = AppDataSource.getRepository(Permission);
  const roleRepo = AppDataSource.getRepository(Role);
  const userRepo = AppDataSource.getRepository(User);
  const settingRepo = AppDataSource.getRepository(SystemSetting);
  const projectRepo = AppDataSource.getRepository(Project);

  const permDefs = [
    { name: 'users:read', module: 'users', action: 'read', description: 'Kullanıcıları görüntüle' },
    { name: 'users:write', module: 'users', action: 'write', description: 'Kullanıcı oluştur/düzenle' },
    { name: 'users:delete', module: 'users', action: 'delete', description: 'Kullanıcı sil' },
    { name: 'projects:read', module: 'projects', action: 'read', description: 'Projeleri görüntüle' },
    { name: 'projects:write', module: 'projects', action: 'write', description: 'Proje oluştur/düzenle' },
    { name: 'projects:delete', module: 'projects', action: 'delete', description: 'Proje sil' },
    { name: 'roles:manage', module: 'roles', action: 'manage', description: 'Rol yönetimi' },
    { name: 'settings:manage', module: 'settings', action: 'manage', description: 'Sistem ayarları' },
    { name: 'analytics:read', module: 'analytics', action: 'read', description: 'Analizleri görüntüle' },
  ];

  const savedPerms: Permission[] = [];
  for (const p of permDefs) {
    let perm = await permRepo.findOne({ where: { name: p.name } });
    if (!perm) perm = await permRepo.save(permRepo.create(p));
    savedPerms.push(perm);
  }

  const roleDefs = [
    { name: 'Süper Admin', description: 'Tam yetkili sistem yöneticisi', permNames: permDefs.map(p => p.name) },
    { name: 'Akademisyen', description: 'Proje sahibi akademik personel', permNames: ['projects:read', 'projects:write'] },
    { name: 'Araştırma Görevlisi', description: 'Araştırmacı', permNames: ['projects:read'] },
    { name: 'Bölüm Başkanı', description: 'Bölüm yöneticisi', permNames: ['projects:read', 'analytics:read'] },
    { name: 'Dekan', description: 'Fakülte yöneticisi', permNames: ['projects:read', 'analytics:read'] },
  ];

  const savedRoles: Record<string, Role> = {};
  for (const rd of roleDefs) {
    let role = await roleRepo.findOne({ where: { name: rd.name } });
    if (!role) {
      role = roleRepo.create({ name: rd.name, description: rd.description, isSystem: true });
      role.permissions = savedPerms.filter(p => rd.permNames.includes(p.name));
      role = await roleRepo.save(role);
    }
    savedRoles[rd.name] = role;
  }

  const userDefs = [
    { firstName: 'Sistem', lastName: 'Yöneticisi', email: 'admin@mku.edu.tr', password: 'Admin123!', title: 'Sistem Yöneticisi', faculty: 'TTO', department: 'Teknoloji Transfer Ofisi', roleName: 'Süper Admin' },
    { firstName: 'Ahmet', lastName: 'Yılmaz', email: 'ahmet.yilmaz@mku.edu.tr', password: 'Demo123!', title: 'Doç. Dr.', faculty: 'Mühendislik Fakültesi', department: 'Bilgisayar Mühendisliği', roleName: 'Akademisyen' },
    { firstName: 'Fatma', lastName: 'Şahin', email: 'fatma.sahin@mku.edu.tr', password: 'Demo123!', title: 'Arş. Gör.', faculty: 'Mühendislik Fakültesi', department: 'Bilgisayar Mühendisliği', roleName: 'Araştırma Görevlisi' },
    { firstName: 'Mehmet', lastName: 'Kaya', email: 'mehmet.kaya@mku.edu.tr', password: 'Demo123!', title: 'Prof. Dr.', faculty: 'Mühendislik Fakültesi', department: 'Elektrik-Elektronik Mühendisliği', roleName: 'Bölüm Başkanı' },
    { firstName: 'Ayşe', lastName: 'Demir', email: 'ayse.demir@mku.edu.tr', password: 'Demo123!', title: 'Prof. Dr.', faculty: 'Mühendislik Fakültesi', department: 'Mühendislik Dekanlığı', roleName: 'Dekan' },
  ];

  const savedUsers: Record<string, User> = {};
  for (const ud of userDefs) {
    let u = await userRepo.findOne({ where: { email: ud.email } });
    if (!u) {
      const nu = new User();
      nu.firstName = ud.firstName;
      nu.lastName = ud.lastName;
      nu.email = ud.email;
      nu.password = await bcrypt.hash(ud.password, 12);
      nu.title = ud.title;
      nu.faculty = ud.faculty;
      nu.department = ud.department;
      nu.roleId = savedRoles[ud.roleName].id;
      nu.isActive = true;
      u = await userRepo.save(nu);
    }
    savedUsers[ud.email] = u;
  }
  console.log('✅ Kullanıcılar oluşturuldu');

  const ahmet = savedUsers['ahmet.yilmaz@mku.edu.tr'];
  const projDefs = [
    { title: 'Yapay Zeka Destekli Tarım Otomasyonu', description: 'Hatay ilinde tarımsal verimliliği artırmak için makine öğrenmesi tabanlı sistem.', type: 'tubitak', status: 'active', faculty: 'Mühendislik Fakültesi', department: 'Bilgisayar Mühendisliği', budget: 450000, fundingSource: 'TÜBİTAK 1001', startDate: '2024-01-01', endDate: '2026-01-01', tags: ['tubitak', 'yapay zeka'] },
    { title: 'Akıllı Enerji Yönetim Sistemi', description: 'Kampüs enerji tüketimini optimize eden IoT tabanlı sistem.', type: 'bap', status: 'active', faculty: 'Mühendislik Fakültesi', department: 'Elektrik-Elektronik Mühendisliği', budget: 125000, fundingSource: 'BAP', startDate: '2024-03-01', endDate: '2025-09-01', tags: ['bap', 'iot'] },
    { title: 'Hatay Kültürel Mirası Dijitalleştirme', description: 'Tarihi eserlerin 3D modelleme ile dijitalleştirilmesi.', type: 'eu', status: 'completed', faculty: 'Fen-Edebiyat Fakültesi', department: 'Arkeoloji', budget: 890000, fundingSource: 'Horizon Europe', startDate: '2022-01-01', endDate: '2024-12-31', tags: ['ab', 'dijital'] },
    { title: 'Zeytin Yağı Kalite Analiz Sistemi', description: 'Spektroskopi ile zeytin yağı kalite analizi.', type: 'industry', status: 'pending', faculty: 'Mühendislik Fakültesi', department: 'Gıda Mühendisliği', budget: 200000, fundingSource: 'Sanayi İşbirliği', startDate: '2025-01-01', endDate: '2026-06-01', tags: ['sanayi'] },
    { title: 'Drone Tabanlı Orman Yangını Tespiti', description: 'Derin öğrenme ile erken yangın tespit sistemi.', type: 'tubitak', status: 'active', faculty: 'Mühendislik Fakültesi', department: 'Bilgisayar Mühendisliği', budget: 320000, fundingSource: 'TÜBİTAK 3001', startDate: '2024-06-01', endDate: '2026-12-01', tags: ['tubitak', 'drone'] },
  ];

  for (const pd of projDefs) {
    const exists = await projectRepo.findOne({ where: { title: pd.title } });
    if (!exists) {
      const proj = new Project();
      proj.title = pd.title;
      proj.description = pd.description;
      proj.type = pd.type;
      proj.status = pd.status;
      proj.faculty = pd.faculty;
      proj.department = pd.department;
      proj.budget = pd.budget;
      proj.fundingSource = pd.fundingSource;
      proj.startDate = pd.startDate;
      proj.endDate = pd.endDate;
      proj.ownerId = ahmet.id;
      proj.tags = pd.tags;
      await projectRepo.save(proj);
    }
  }
  console.log('✅ Demo projeler oluşturuldu');

  const settingDefs = [
    { key: 'site_name', value: 'MKÜ TTO', label: 'Site Adı', type: 'text' },
    { key: 'site_title', value: 'Hatay Mustafa Kemal Üniversitesi Teknoloji Transfer Ofisi', label: 'Site Başlığı', type: 'text' },
    { key: 'primary_color', value: '#1a3a6b', label: 'Ana Renk', type: 'color' },
    { key: 'secondary_color', value: '#c8a45a', label: 'Vurgu Rengi', type: 'color' },
    { key: 'footer_text', value: '© 2025 Hatay MKÜ TTO. Tüm hakları saklıdır.', label: 'Footer', type: 'text' },
  ];
  for (const s of settingDefs) {
    const ex = await settingRepo.findOne({ where: { key: s.key } });
    if (!ex) await settingRepo.save(settingRepo.create(s));
  }
  console.log('✅ Sistem ayarları oluşturuldu');

  // Project Types
  const projectTypeRepo = AppDataSource.getRepository(ProjectType);
  const typeDefaults = [
    { key: 'tubitak', label: 'TÜBİTAK', color: '#1d4ed8', isSystem: true },
    { key: 'bap', label: 'BAP', color: '#7c3aed', isSystem: true },
    { key: 'eu', label: 'AB Projesi', color: '#d97706', isSystem: true },
    { key: 'industry', label: 'Sanayi Projesi', color: '#ea580c', isSystem: true },
    { key: 'other', label: 'Diğer', color: '#64748b', isSystem: true },
  ];
  for (const td of typeDefaults) {
    const ex = await projectTypeRepo.findOne({ where: { key: td.key } });
    if (!ex) {
      const t = new ProjectType();
      Object.assign(t, td);
      t.isActive = true;
      await projectTypeRepo.save(t);
    }
  }
  console.log('✅ Proje türleri oluşturuldu');

  // Faculties
  const facultyRepo = AppDataSource.getRepository(Faculty);
  const facultyDefaults = [
    { name: 'Mühendislik Fakültesi', shortName: 'MÜH', color: '#1d4ed8' },
    { name: 'Fen-Edebiyat Fakültesi', shortName: 'FEN', color: '#7c3aed' },
    { name: 'İktisadi ve İdari Bilimler Fakültesi', shortName: 'İİBF', color: '#059669' },
    { name: 'Tıp Fakültesi', shortName: 'TIP', color: '#dc2626' },
    { name: 'Eğitim Fakültesi', shortName: 'EĞT', color: '#d97706' },
    { name: 'Güzel Sanatlar, Tasarım ve Mimarlık Fakültesi', shortName: 'GSMT', color: '#ec4899' },
    { name: 'Su Ürünleri Fakültesi', shortName: 'SÜ', color: '#0891b2' },
    { name: 'Ziraat Fakültesi', shortName: 'ZİR', color: '#65a30d' },
    { name: 'Teknoloji Fakültesi', shortName: 'TEK', color: '#ea580c' },
    { name: 'TTO', shortName: 'TTO', color: '#c8a45a' },
  ];
  for (const fd of facultyDefaults) {
    const ex = await facultyRepo.findOne({ where: { name: fd.name } });
    if (!ex) {
      const f = new Faculty();
      Object.assign(f, fd);
      f.isActive = true;
      await facultyRepo.save(f);
    }
  }
  console.log('✅ Fakülteler oluşturuldu');

  // Report Types
  const reportTypeRepo = AppDataSource.getRepository(ReportType);
  const reportTypeDefaults = [
    { key:'progress', label:'İlerleme Raporu', color:'#1a3a6b', showProgress:1, isSystem:1, description:'Genel proje ilerlemesini belgeler', sortOrder:0 },
    { key:'milestone', label:'Kilometre Taşı', color:'#c8a45a', showProgress:1, isSystem:1, description:'Önemli proje dönüm noktaları', sortOrder:1 },
    { key:'financial', label:'Finansal Rapor', color:'#059669', showProgress:0, isSystem:1, description:'Bütçe ve harcama durumu', sortOrder:2 },
    { key:'technical', label:'Teknik Rapor', color:'#7c3aed', showProgress:0, isSystem:1, description:'Teknik çalışmalar ve bulgular', sortOrder:3 },
    { key:'risk', label:'Risk Raporu', color:'#dc2626', showProgress:0, isSystem:1, description:'Proje riskleri ve önlemleri', sortOrder:4 },
    { key:'final', label:'Final Rapor', color:'#0891b2', showProgress:1, isSystem:1, description:'Proje kapanış ve sonuç raporu', sortOrder:5 },
  ];
  for (const d of reportTypeDefaults) {
    const ex = await reportTypeRepo.findOne({ where: { key: d.key } });
    if (!ex) {
      const t = new ReportType();
      Object.assign(t, d);
      (t as any).isActive = true;
      await reportTypeRepo.save(t);
    }
  }
  console.log('✅ Rapor türleri oluşturuldu');

  await AppDataSource.destroy();
  console.log('\n🎉 Seed tamamlandı!');
  console.log('──────────────────────────────────────');
  console.log('Admin:       admin@mku.edu.tr  /  Admin123!');
  console.log('Akademisyen: ahmet.yilmaz@mku.edu.tr  /  Demo123!');
  console.log('──────────────────────────────────────');
}

seed().catch(err => { console.error('Seed hatası:', err); process.exit(1); });
