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
    { name: 'ethics:read', module: 'ethics', action: 'read', description: 'Etik kurul başvurularını görüntüle' },
    { name: 'ethics:manage', module: 'ethics', action: 'manage', description: 'Etik kurul kararı ver (onayla/reddet)' },
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
    { name: 'Dekan', description: 'Fakülte yöneticisi', permNames: ['projects:read', 'analytics:read', 'ethics:read'] },
    { name: 'Rektör', description: 'Üniversite rektörü — tüm projeleri ve etik kurulu yönetir', permNames: ['projects:read', 'analytics:read', 'ethics:read', 'ethics:manage'] },
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

  const ahmet   = savedUsers['ahmet.yilmaz@mku.edu.tr'];
  const mehmet  = savedUsers['mehmet.kaya@mku.edu.tr'];
  const ayse    = savedUsers['ayse.demir@mku.edu.tr'];
  const fatma   = savedUsers['fatma.sahin@mku.edu.tr'];
  const defaultOwner = (ahmet || mehmet || ayse || fatma)?.id;

  const projDefs: any[] = [
    // ═══ MÜHENDİSLİK FAKÜLTESİ ═══
    {
      title: 'Yapay Zeka Destekli Tarım Otomasyonu',
      description: 'Hatay bölgesinde narenciye ve zeytin üretiminde verim kaybını azaltmak için makine öğrenmesi tabanlı erken hastalık teşhis sistemi.',
      projectText: 'Projede, drone ile yaprak görüntüleri alınacak, CNN mimarisiyle hastalık sınıflandırması yapılacak ve çiftçilere mobil uygulama üzerinden anlık uyarılar gönderilecektir. İlk saha denemeleri Antakya ve Samandağ bölgelerinde yürütülecektir.',
      type: 'tubitak', status: 'active', faculty: 'Mühendislik Fakültesi', department: 'Bilgisayar Mühendisliği',
      budget: 450000, fundingSource: 'TÜBİTAK 1001', startDate: '2024-01-01', endDate: '2026-01-01',
      tags: ['yapay zeka', 'tarım', 'iot'], keywords: ['machine learning', 'agriculture', 'disease detection'],
      sdgGoals: ['SKH-2', 'SKH-9', 'SKH-13'], owner: ahmet?.id,
    },
    {
      title: 'Akıllı Enerji Yönetim Sistemi',
      description: 'MKÜ Tayfur Sökmen Kampüsü enerji tüketimini optimize eden IoT tabanlı sistem; bina bazlı tüketim izleme ve tahmin.',
      projectText: 'Bina ve bölüm bazında elektrik tüketim verisi 5 dakikalık çözünürlükte toplanacak, LSTM modeli ile 24 saat ileri tahmin yapılacak. Tasarruf senaryoları panelde görselleştirilecektir.',
      type: 'bap', status: 'active', faculty: 'Mühendislik Fakültesi', department: 'Elektrik-Elektronik Mühendisliği',
      budget: 125000, fundingSource: 'BAP', startDate: '2024-03-01', endDate: '2025-09-01',
      tags: ['iot', 'enerji', 'bap'], keywords: ['IoT', 'energy management', 'LSTM'],
      sdgGoals: ['SKH-7', 'SKH-11', 'SKH-13'], owner: mehmet?.id,
    },
    {
      title: 'Drone Tabanlı Orman Yangını Erken Tespiti',
      description: 'Amanos Dağları\'nda derin öğrenme ile uydu + drone görüntüleri üzerinden yangın erken uyarı sistemi.',
      projectText: 'YOLOv8 tabanlı duman/ateş algılayıcı + LoRa ile uzak köylere uyarı. Orman Genel Müdürlüğü Hatay Şube ile ortaklık.',
      type: 'tubitak', status: 'active', faculty: 'Mühendislik Fakültesi', department: 'Bilgisayar Mühendisliği',
      budget: 320000, fundingSource: 'TÜBİTAK 3001', startDate: '2024-06-01', endDate: '2026-12-01',
      tags: ['drone', 'computer vision'], keywords: ['YOLO', 'forest fire detection', 'remote sensing'],
      sdgGoals: ['SKH-13', 'SKH-15'], owner: ahmet?.id,
    },
    {
      title: 'Zeytin Yağı Kalite Analiz Sistemi',
      description: 'NIR spektroskopisi + kemometri ile zeytin yağı kalite kontrol cihazı — Hatay zeytinyağı üreticileri için.',
      type: 'industry', status: 'pending', faculty: 'Mühendislik Fakültesi', department: 'Gıda Mühendisliği',
      budget: 200000, fundingSource: 'Sanayi İşbirliği', startDate: '2025-01-01', endDate: '2026-06-01',
      tags: ['sanayi', 'gıda'], keywords: ['NIR spectroscopy', 'olive oil', 'chemometrics'],
      sdgGoals: ['SKH-2', 'SKH-12'], owner: ahmet?.id,
    },
    {
      title: '5G Destekli Akıllı Trafik Yönetimi',
      description: 'Antakya şehir merkezinde V2X haberleşme ile trafik yoğunluğu optimizasyonu.',
      type: 'tubitak', status: 'completed', faculty: 'Mühendislik Fakültesi', department: 'Elektrik-Elektronik Mühendisliği',
      budget: 680000, fundingSource: 'TÜBİTAK 1005', startDate: '2021-09-01', endDate: '2024-03-01',
      tags: ['5G', 'trafik', 'iot'], keywords: ['5G', 'V2X', 'smart city'],
      sdgGoals: ['SKH-9', 'SKH-11'], owner: mehmet?.id,
    },

    // ═══ FEN-EDEBİYAT FAKÜLTESİ ═══
    {
      title: 'Hatay Kültürel Mirası Dijitalleştirme',
      description: 'Antakya Arkeoloji Müzesi ve Vespasianus Titus Tüneli mozaiklerinin fotogrametri + LiDAR ile 3B arşivlenmesi.',
      projectText: 'Deprem sonrası risk altındaki 27 tarihi yapının dijital ikizi üretilecek. Veri Europeana platformunda açık erişime sunulacak.',
      type: 'eu', status: 'completed', faculty: 'Fen-Edebiyat Fakültesi', department: 'Arkeoloji',
      budget: 890000, fundingSource: 'Horizon Europe', startDate: '2022-01-01', endDate: '2024-12-31',
      tags: ['ab', 'dijital', 'miras'], keywords: ['cultural heritage', 'photogrammetry', 'LiDAR', '3D reconstruction'],
      sdgGoals: ['SKH-11', 'SKH-4'], owner: fatma?.id,
    },
    {
      title: 'Akdeniz Foku Populasyon Dinamikleri',
      description: 'İskenderun Körfezi ve çevre sularda Monachus monachus türünün çevresel DNA (eDNA) ile izlenmesi.',
      type: 'tubitak', status: 'active', faculty: 'Fen-Edebiyat Fakültesi', department: 'Biyoloji',
      budget: 285000, fundingSource: 'TÜBİTAK 1001', startDate: '2024-09-01', endDate: '2026-12-01',
      tags: ['deniz biyolojisi', 'edna'], keywords: ['environmental DNA', 'Mediterranean monk seal', 'marine biology'],
      sdgGoals: ['SKH-14', 'SKH-15'], owner: defaultOwner,
    },
    {
      title: 'Hatay Ağızları Dilbilimsel Atlası',
      description: 'Hatay\'ın 12 ilçesinde Türkçe, Arapça ve azınlık dillerinin sosyodilbilimsel haritalanması.',
      type: 'bap', status: 'completed', faculty: 'Fen-Edebiyat Fakültesi', department: 'Türk Dili ve Edebiyatı',
      budget: 95000, fundingSource: 'BAP', startDate: '2022-02-01', endDate: '2024-02-01',
      tags: ['dilbilim', 'kültür'], keywords: ['sociolinguistics', 'dialectology', 'Turkish', 'Arabic'],
      sdgGoals: ['SKH-4', 'SKH-16'], owner: defaultOwner,
    },

    // ═══ İİBF ═══
    {
      title: 'Bölgesel Kalkınma Göstergeleri Analitiği',
      description: 'Doğu Akdeniz bölgesi için uydu gece ışığı + cep telefonu mobilitesi ile ekonomik aktivite göstergeleri geliştirilmesi.',
      projectText: 'VIIRS gece ışığı verileri ile ilçe bazlı GSYH proxy üretilecek. Deprem sonrası ekonomik toparlanma 6 ay aralıklarla ölçülecek.',
      type: 'bap', status: 'completed', faculty: 'İktisadi ve İdari Bilimler Fakültesi', department: 'İktisat',
      budget: 145000, fundingSource: 'BAP', startDate: '2022-06-01', endDate: '2024-06-01',
      tags: ['veri bilimi', 'ekonometri'], keywords: ['nighttime lights', 'GDP proxy', 'regional economics'],
      sdgGoals: ['SKH-8', 'SKH-10'], owner: defaultOwner,
    },
    {
      title: 'Dijital KOBİ Dönüşüm Modeli',
      description: 'Hatay OSB\'deki 120 KOBİ için dijital olgunluk endeksi ve dönüşüm yol haritası.',
      type: 'tubitak', status: 'active', faculty: 'İktisadi ve İdari Bilimler Fakültesi', department: 'İşletme',
      budget: 215000, fundingSource: 'TÜBİTAK 1507', startDate: '2024-04-01', endDate: '2026-04-01',
      tags: ['dijital dönüşüm', 'kobi'], keywords: ['digital transformation', 'SME', 'industry 4.0'],
      sdgGoals: ['SKH-8', 'SKH-9'], owner: defaultOwner,
    },
    {
      title: 'Sınır Ticareti Ekonometrik Analizi',
      description: 'Türkiye-Suriye sınır geçişlerindeki resmi ve gayri-resmi ticaret akımlarının dinamik panel modeli.',
      type: 'tubitak', status: 'pending', faculty: 'İktisadi ve İdari Bilimler Fakültesi', department: 'İktisat',
      budget: 175000, fundingSource: 'TÜBİTAK 1001', startDate: '2025-03-01', endDate: '2027-03-01',
      tags: ['ekonometri', 'sınır ekonomisi'], keywords: ['border trade', 'panel data', 'dynamic model'],
      sdgGoals: ['SKH-8', 'SKH-17'], owner: defaultOwner,
    },

    // ═══ TIP FAKÜLTESİ ═══
    {
      title: 'Akdeniz Tipi Anemi Genetik Haritalama',
      description: 'Hatay bölgesinde β-talasemi taşıyıcılığı prevalansı ve HBB gen varyantları için toplum tarama projesi.',
      projectText: 'Premarital tarama programı kapsamında 5000 bireyde HBB dizileme. Hastane ve halk sağlığı merkezleri ortaklığıyla yürütülecek.',
      type: 'tubitak', status: 'active', faculty: 'Tıp Fakültesi', department: 'Tıbbi Genetik',
      budget: 520000, fundingSource: 'TÜBİTAK 1001', startDate: '2024-02-01', endDate: '2026-08-01',
      tags: ['genetik', 'halk sağlığı'], keywords: ['thalassemia', 'HBB gene', 'population screening'],
      sdgGoals: ['SKH-3'], ethicsRequired: true, owner: defaultOwner,
    },
    {
      title: 'Diyabetik Nöropati Erken Tanı Biyobelirteçleri',
      description: 'Tip 2 diyabet hastalarında sural sinir MR ve kan miRNA panelini birleştiren erken tanı testi.',
      type: 'tubitak', status: 'active', faculty: 'Tıp Fakültesi', department: 'İç Hastalıkları',
      budget: 385000, fundingSource: 'TÜBİTAK 3501', startDate: '2024-05-01', endDate: '2026-11-01',
      tags: ['biyomarker', 'diyabet'], keywords: ['diabetic neuropathy', 'miRNA', 'biomarker'],
      sdgGoals: ['SKH-3'], ethicsRequired: true, owner: defaultOwner,
    },
    {
      title: 'COVID Sonrası Pulmoner Rehabilitasyon Protokolü',
      description: 'Uzun COVID hastalarında egzersiz + solunum rehabilitasyonu klinik protokolü.',
      type: 'bap', status: 'completed', faculty: 'Tıp Fakültesi', department: 'Göğüs Hastalıkları',
      budget: 85000, fundingSource: 'BAP', startDate: '2023-01-01', endDate: '2024-09-01',
      tags: ['covid', 'rehabilitasyon'], keywords: ['long COVID', 'pulmonary rehabilitation'],
      sdgGoals: ['SKH-3'], ethicsRequired: true, ethicsApproved: true, owner: defaultOwner,
    },

    // ═══ EĞİTİM FAKÜLTESİ ═══
    {
      title: 'STEM Eğitimi Etkisi — Bölgesel Ölçüm',
      description: 'Hatay\'daki 40 ortaokulda STEM müfredatının kız öğrenci üniversite tercihlerine etkisinin 4 yıllık longitudinal çalışması.',
      type: 'bap', status: 'active', faculty: 'Eğitim Fakültesi', department: 'İlköğretim',
      budget: 165000, fundingSource: 'BAP', startDate: '2023-09-01', endDate: '2027-09-01',
      tags: ['stem', 'eğitim'], keywords: ['STEM education', 'gender equality', 'longitudinal study'],
      sdgGoals: ['SKH-4', 'SKH-5'], owner: ayse?.id,
    },
    {
      title: 'Uzaktan Eğitimde Öğrenci Bağlılığı Analizi',
      description: 'LMS loglarından ve göz takibinden öğrenme bağlılığı modeli — deprem sonrası online eğitimin etkileri.',
      type: 'tubitak', status: 'completed', faculty: 'Eğitim Fakültesi', department: 'Eğitim Bilimleri',
      budget: 155000, fundingSource: 'TÜBİTAK 1001', startDate: '2022-08-01', endDate: '2024-08-01',
      tags: ['dijital eğitim', 'analitik'], keywords: ['learning analytics', 'engagement', 'remote education'],
      sdgGoals: ['SKH-4'], owner: ayse?.id,
    },

    // ═══ GÜZEL SANATLAR ═══
    {
      title: 'Hatay Mozaik Motiflerinin Dijital Arşivi',
      description: 'Antakya mozaik sanatının desen veritabanı ve çağdaş tasarımcılar için desen üreteç algoritması.',
      type: 'bap', status: 'active', faculty: 'Güzel Sanatlar, Tasarım ve Mimarlık Fakültesi', department: 'Grafik Tasarım',
      budget: 110000, fundingSource: 'BAP', startDate: '2024-02-01', endDate: '2025-12-01',
      tags: ['tasarım', 'dijital miras'], keywords: ['mosaic', 'pattern design', 'cultural archive'],
      sdgGoals: ['SKH-11'], owner: defaultOwner,
    },
    {
      title: 'Tarihi Yapılarda Parametrik Restorasyon Modellemesi',
      description: 'Deprem sonrası hasarlı dini yapılar için jenerik geometri tabanlı rekonstrüksiyon metodolojisi.',
      type: 'eu', status: 'active', faculty: 'Güzel Sanatlar, Tasarım ve Mimarlık Fakültesi', department: 'Mimarlık',
      budget: 750000, fundingSource: 'Horizon Europe MSCA', startDate: '2024-09-01', endDate: '2027-09-01',
      tags: ['mimarlık', 'restorasyon'], keywords: ['parametric design', 'heritage restoration', 'BIM'],
      sdgGoals: ['SKH-11'], owner: defaultOwner,
    },

    // ═══ SU ÜRÜNLERİ ═══
    {
      title: 'İskenderun Körfezi Mikroplastik İzleme Ağı',
      description: 'Sahil boyunca 20 istasyonda aylık mikroplastik ölçümü ve deniz canlılarında biyoakümülasyon çalışması.',
      type: 'tubitak', status: 'active', faculty: 'Su Ürünleri Fakültesi', department: 'Su Ürünleri',
      budget: 295000, fundingSource: 'TÜBİTAK 1001', startDate: '2024-04-01', endDate: '2027-04-01',
      tags: ['deniz kirliliği', 'mikroplastik'], keywords: ['microplastic', 'marine pollution', 'bioaccumulation'],
      sdgGoals: ['SKH-14', 'SKH-6'], owner: defaultOwner,
    },
    {
      title: 'Sürdürülebilir Akuaponik Üretim Sistemi',
      description: 'Kapalı devre akuaponik tesisi — çipura ve fesleğen entegre üretim modeli.',
      type: 'bap', status: 'active', faculty: 'Su Ürünleri Fakültesi', department: 'Su Ürünleri',
      budget: 140000, fundingSource: 'BAP', startDate: '2024-08-01', endDate: '2026-08-01',
      tags: ['akuaponik', 'sürdürülebilirlik'], keywords: ['aquaponics', 'sustainable agriculture', 'recirculating system'],
      sdgGoals: ['SKH-2', 'SKH-14', 'SKH-12'], owner: defaultOwner,
    },

    // ═══ ZİRAAT FAKÜLTESİ ═══
    {
      title: 'Tuza Dayanıklı Domates Islahı',
      description: 'Hatay ovası tuzluluk sorununa karşı marker-destekli seleksiyon ile yeni domates genotipleri.',
      projectText: 'SSR marker taraması, doku kültürü ve sera denemeleri. Islah edilen hatlar Tarım Bakanlığı tescil sürecine alınacak.',
      type: 'tubitak', status: 'active', faculty: 'Ziraat Fakültesi', department: 'Tarla Bitkileri',
      budget: 410000, fundingSource: 'TÜBİTAK 1001', startDate: '2024-01-01', endDate: '2027-01-01',
      tags: ['bitki ıslahı', 'tuzluluk'], keywords: ['plant breeding', 'salt tolerance', 'marker-assisted selection', 'tomato'],
      sdgGoals: ['SKH-2', 'SKH-13'], owner: defaultOwner,
    },
    {
      title: 'Zeytin Tozlanmasında Arıcılık Etkileri',
      description: 'Hatay zeytinliklerinde arıcılık ile verim ilişkisi — pollen transferi çalışması.',
      type: 'tubitak', status: 'completed', faculty: 'Ziraat Fakültesi', department: 'Zootekni',
      budget: 175000, fundingSource: 'TÜBİTAK 1001', startDate: '2021-03-01', endDate: '2024-03-01',
      tags: ['arıcılık', 'zeytin'], keywords: ['pollination', 'beekeeping', 'olive yield'],
      sdgGoals: ['SKH-2', 'SKH-15'], owner: defaultOwner,
    },
    {
      title: 'İklim Değişikliği Vejetasyon Haritası',
      description: 'Hatay için 30 yıllık Landsat/MODIS ile vejetasyon değişim analizi ve gelecek projeksiyonları.',
      type: 'eu', status: 'active', faculty: 'Ziraat Fakültesi', department: 'Toprak Bilimi ve Bitki Besleme',
      budget: 620000, fundingSource: 'Horizon Europe', startDate: '2024-03-01', endDate: '2027-03-01',
      tags: ['uzaktan algılama', 'iklim'], keywords: ['remote sensing', 'climate change', 'NDVI', 'vegetation'],
      sdgGoals: ['SKH-13', 'SKH-15'], owner: defaultOwner,
    },

    // ═══ TEKNOLOJİ FAKÜLTESİ ═══
    {
      title: 'Yenilenebilir Enerji Mikroşebeke Yönetimi',
      description: 'Güneş + rüzgar + akü hibrit mikroşebeke için tahmin destekli optimizasyon algoritması.',
      type: 'tubitak', status: 'active', faculty: 'Teknoloji Fakültesi', department: 'Elektrik Elektronik Mühendisliği',
      budget: 380000, fundingSource: 'TÜBİTAK 1001', startDate: '2024-07-01', endDate: '2026-07-01',
      tags: ['yenilenebilir enerji', 'optimizasyon'], keywords: ['microgrid', 'renewable energy', 'energy storage'],
      sdgGoals: ['SKH-7', 'SKH-13'], owner: defaultOwner,
    },
    {
      title: 'Otomotiv Sensör Prototipleme Merkezi',
      description: 'ADAS sensörleri için karakteristik test laboratuvarı — Hatay OSB sanayi işbirliği.',
      type: 'industry', status: 'pending', faculty: 'Teknoloji Fakültesi', department: 'Mekatronik Mühendisliği',
      budget: 950000, fundingSource: 'Sanayi İşbirliği', startDate: '2025-01-01', endDate: '2027-06-01',
      tags: ['otomotiv', 'sensör'], keywords: ['ADAS', 'LiDAR', 'automotive sensors'],
      sdgGoals: ['SKH-9'], ipStatus: 'pending', owner: defaultOwner,
    },
  ];

  for (const pd of projDefs) {
    const exists = await projectRepo.findOne({ where: { title: pd.title } });
    if (!exists) {
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
      proj.ownerId = pd.owner || defaultOwner;
      proj.tags = pd.tags || [];
      if (pd.keywords) proj.keywords = pd.keywords;
      if (pd.sdgGoals) proj.sdgGoals = pd.sdgGoals;
      if (pd.ethicsRequired) (proj as any).ethicsRequired = pd.ethicsRequired;
      if (pd.ethicsApproved) (proj as any).ethicsApproved = pd.ethicsApproved;
      if (pd.ipStatus) (proj as any).ipStatus = pd.ipStatus;
      await projectRepo.save(proj);
    }
  }
  console.log(`✅ Demo projeler oluşturuldu (${projDefs.length} toplam)`);

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
