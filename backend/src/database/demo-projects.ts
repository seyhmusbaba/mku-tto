/**
 * Ortak demo proje tanımları — hem seed.ts (standalone script) hem de
 * admin "seed-demo" endpoint'i (Railway shell yokken production seed için) kullanır.
 */

export interface DemoProjectDef {
  title: string;
  description: string;
  projectText?: string;
  type: string;
  status: string;
  faculty: string;
  department: string;
  budget: number;
  fundingSource: string;
  startDate: string;
  endDate: string;
  tags?: string[];
  keywords?: string[];
  sdgGoals?: string[];
  ethicsRequired?: boolean;
  ethicsApproved?: boolean;
  ipStatus?: string;
  ownerEmail?: string;
}

export const DEMO_PROJECTS: DemoProjectDef[] = [
  // ═══ MÜHENDİSLİK FAKÜLTESİ ═══
  {
    title: 'Yapay Zeka Destekli Tarım Otomasyonu',
    description: 'Hatay bölgesinde narenciye ve zeytin üretiminde verim kaybını azaltmak için makine öğrenmesi tabanlı erken hastalık teşhis sistemi.',
    projectText: 'Projede, drone ile yaprak görüntüleri alınacak, CNN mimarisiyle hastalık sınıflandırması yapılacak ve çiftçilere mobil uygulama üzerinden anlık uyarılar gönderilecektir. İlk saha denemeleri Antakya ve Samandağ bölgelerinde yürütülecektir.',
    type: 'tubitak', status: 'active', faculty: 'Mühendislik Fakültesi', department: 'Bilgisayar Mühendisliği',
    budget: 450000, fundingSource: 'TÜBİTAK 1001', startDate: '2024-01-01', endDate: '2026-01-01',
    tags: ['yapay zeka', 'tarım', 'iot'], keywords: ['machine learning', 'agriculture', 'disease detection'],
    sdgGoals: ['SKH-2', 'SKH-9', 'SKH-13'], ownerEmail: 'ahmet.yilmaz@mku.edu.tr',
  },
  {
    title: 'Akıllı Enerji Yönetim Sistemi',
    description: 'MKÜ Tayfur Sökmen Kampüsü enerji tüketimini optimize eden IoT tabanlı sistem; bina bazlı tüketim izleme ve tahmin.',
    projectText: 'Bina ve bölüm bazında elektrik tüketim verisi 5 dakikalık çözünürlükte toplanacak, LSTM modeli ile 24 saat ileri tahmin yapılacak. Tasarruf senaryoları panelde görselleştirilecektir.',
    type: 'bap', status: 'active', faculty: 'Mühendislik Fakültesi', department: 'Elektrik-Elektronik Mühendisliği',
    budget: 125000, fundingSource: 'BAP', startDate: '2024-03-01', endDate: '2025-09-01',
    tags: ['iot', 'enerji', 'bap'], keywords: ['IoT', 'energy management', 'LSTM'],
    sdgGoals: ['SKH-7', 'SKH-11', 'SKH-13'], ownerEmail: 'mehmet.kaya@mku.edu.tr',
  },
  {
    title: 'Drone Tabanlı Orman Yangını Erken Tespiti',
    description: 'Amanos Dağları\'nda derin öğrenme ile uydu + drone görüntüleri üzerinden yangın erken uyarı sistemi.',
    projectText: 'YOLOv8 tabanlı duman/ateş algılayıcı + LoRa ile uzak köylere uyarı. Orman Genel Müdürlüğü Hatay Şube ile ortaklık.',
    type: 'tubitak', status: 'active', faculty: 'Mühendislik Fakültesi', department: 'Bilgisayar Mühendisliği',
    budget: 320000, fundingSource: 'TÜBİTAK 3001', startDate: '2024-06-01', endDate: '2026-12-01',
    tags: ['drone', 'computer vision'], keywords: ['YOLO', 'forest fire detection', 'remote sensing'],
    sdgGoals: ['SKH-13', 'SKH-15'], ownerEmail: 'ahmet.yilmaz@mku.edu.tr',
  },
  {
    title: 'Zeytin Yağı Kalite Analiz Sistemi',
    description: 'NIR spektroskopisi + kemometri ile zeytin yağı kalite kontrol cihazı — Hatay zeytinyağı üreticileri için.',
    type: 'industry', status: 'pending', faculty: 'Mühendislik Fakültesi', department: 'Gıda Mühendisliği',
    budget: 200000, fundingSource: 'Sanayi İşbirliği', startDate: '2025-01-01', endDate: '2026-06-01',
    tags: ['sanayi', 'gıda'], keywords: ['NIR spectroscopy', 'olive oil', 'chemometrics'],
    sdgGoals: ['SKH-2', 'SKH-12'], ownerEmail: 'ahmet.yilmaz@mku.edu.tr',
  },
  {
    title: '5G Destekli Akıllı Trafik Yönetimi',
    description: 'Antakya şehir merkezinde V2X haberleşme ile trafik yoğunluğu optimizasyonu.',
    type: 'tubitak', status: 'completed', faculty: 'Mühendislik Fakültesi', department: 'Elektrik-Elektronik Mühendisliği',
    budget: 680000, fundingSource: 'TÜBİTAK 1005', startDate: '2021-09-01', endDate: '2024-03-01',
    tags: ['5G', 'trafik', 'iot'], keywords: ['5G', 'V2X', 'smart city'],
    sdgGoals: ['SKH-9', 'SKH-11'], ownerEmail: 'mehmet.kaya@mku.edu.tr',
  },

  // ═══ FEN-EDEBİYAT FAKÜLTESİ ═══
  {
    title: 'Hatay Kültürel Mirası Dijitalleştirme',
    description: 'Antakya Arkeoloji Müzesi ve Vespasianus Titus Tüneli mozaiklerinin fotogrametri + LiDAR ile 3B arşivlenmesi.',
    projectText: 'Deprem sonrası risk altındaki 27 tarihi yapının dijital ikizi üretilecek. Veri Europeana platformunda açık erişime sunulacak.',
    type: 'eu', status: 'completed', faculty: 'Fen-Edebiyat Fakültesi', department: 'Arkeoloji',
    budget: 890000, fundingSource: 'Horizon Europe', startDate: '2022-01-01', endDate: '2024-12-31',
    tags: ['ab', 'dijital', 'miras'], keywords: ['cultural heritage', 'photogrammetry', 'LiDAR', '3D reconstruction'],
    sdgGoals: ['SKH-11', 'SKH-4'], ownerEmail: 'fatma.sahin@mku.edu.tr',
  },
  {
    title: 'Akdeniz Foku Populasyon Dinamikleri',
    description: 'İskenderun Körfezi ve çevre sularda Monachus monachus türünün çevresel DNA (eDNA) ile izlenmesi.',
    type: 'tubitak', status: 'active', faculty: 'Fen-Edebiyat Fakültesi', department: 'Biyoloji',
    budget: 285000, fundingSource: 'TÜBİTAK 1001', startDate: '2024-09-01', endDate: '2026-12-01',
    tags: ['deniz biyolojisi', 'edna'], keywords: ['environmental DNA', 'Mediterranean monk seal', 'marine biology'],
    sdgGoals: ['SKH-14', 'SKH-15'],
  },
  {
    title: 'Hatay Ağızları Dilbilimsel Atlası',
    description: 'Hatay\'ın 12 ilçesinde Türkçe, Arapça ve azınlık dillerinin sosyodilbilimsel haritalanması.',
    type: 'bap', status: 'completed', faculty: 'Fen-Edebiyat Fakültesi', department: 'Türk Dili ve Edebiyatı',
    budget: 95000, fundingSource: 'BAP', startDate: '2022-02-01', endDate: '2024-02-01',
    tags: ['dilbilim', 'kültür'], keywords: ['sociolinguistics', 'dialectology', 'Turkish', 'Arabic'],
    sdgGoals: ['SKH-4', 'SKH-16'],
  },

  // ═══ İİBF ═══
  {
    title: 'Bölgesel Kalkınma Göstergeleri Analitiği',
    description: 'Doğu Akdeniz bölgesi için uydu gece ışığı + cep telefonu mobilitesi ile ekonomik aktivite göstergeleri geliştirilmesi.',
    projectText: 'VIIRS gece ışığı verileri ile ilçe bazlı GSYH proxy üretilecek. Deprem sonrası ekonomik toparlanma 6 ay aralıklarla ölçülecek.',
    type: 'bap', status: 'completed', faculty: 'İktisadi ve İdari Bilimler Fakültesi', department: 'İktisat',
    budget: 145000, fundingSource: 'BAP', startDate: '2022-06-01', endDate: '2024-06-01',
    tags: ['veri bilimi', 'ekonometri'], keywords: ['nighttime lights', 'GDP proxy', 'regional economics'],
    sdgGoals: ['SKH-8', 'SKH-10'],
  },
  {
    title: 'Dijital KOBİ Dönüşüm Modeli',
    description: 'Hatay OSB\'deki 120 KOBİ için dijital olgunluk endeksi ve dönüşüm yol haritası.',
    type: 'tubitak', status: 'active', faculty: 'İktisadi ve İdari Bilimler Fakültesi', department: 'İşletme',
    budget: 215000, fundingSource: 'TÜBİTAK 1507', startDate: '2024-04-01', endDate: '2026-04-01',
    tags: ['dijital dönüşüm', 'kobi'], keywords: ['digital transformation', 'SME', 'industry 4.0'],
    sdgGoals: ['SKH-8', 'SKH-9'],
  },
  {
    title: 'Sınır Ticareti Ekonometrik Analizi',
    description: 'Türkiye-Suriye sınır geçişlerindeki resmi ve gayri-resmi ticaret akımlarının dinamik panel modeli.',
    type: 'tubitak', status: 'pending', faculty: 'İktisadi ve İdari Bilimler Fakültesi', department: 'İktisat',
    budget: 175000, fundingSource: 'TÜBİTAK 1001', startDate: '2025-03-01', endDate: '2027-03-01',
    tags: ['ekonometri', 'sınır ekonomisi'], keywords: ['border trade', 'panel data', 'dynamic model'],
    sdgGoals: ['SKH-8', 'SKH-17'],
  },

  // ═══ TIP FAKÜLTESİ ═══
  {
    title: 'Akdeniz Tipi Anemi Genetik Haritalama',
    description: 'Hatay bölgesinde β-talasemi taşıyıcılığı prevalansı ve HBB gen varyantları için toplum tarama projesi.',
    projectText: 'Premarital tarama programı kapsamında 5000 bireyde HBB dizileme. Hastane ve halk sağlığı merkezleri ortaklığıyla yürütülecek.',
    type: 'tubitak', status: 'active', faculty: 'Tıp Fakültesi', department: 'Tıbbi Genetik',
    budget: 520000, fundingSource: 'TÜBİTAK 1001', startDate: '2024-02-01', endDate: '2026-08-01',
    tags: ['genetik', 'halk sağlığı'], keywords: ['thalassemia', 'HBB gene', 'population screening'],
    sdgGoals: ['SKH-3'], ethicsRequired: true,
  },
  {
    title: 'Diyabetik Nöropati Erken Tanı Biyobelirteçleri',
    description: 'Tip 2 diyabet hastalarında sural sinir MR ve kan miRNA panelini birleştiren erken tanı testi.',
    type: 'tubitak', status: 'active', faculty: 'Tıp Fakültesi', department: 'İç Hastalıkları',
    budget: 385000, fundingSource: 'TÜBİTAK 3501', startDate: '2024-05-01', endDate: '2026-11-01',
    tags: ['biyomarker', 'diyabet'], keywords: ['diabetic neuropathy', 'miRNA', 'biomarker'],
    sdgGoals: ['SKH-3'], ethicsRequired: true,
  },
  {
    title: 'COVID Sonrası Pulmoner Rehabilitasyon Protokolü',
    description: 'Uzun COVID hastalarında egzersiz + solunum rehabilitasyonu klinik protokolü.',
    type: 'bap', status: 'completed', faculty: 'Tıp Fakültesi', department: 'Göğüs Hastalıkları',
    budget: 85000, fundingSource: 'BAP', startDate: '2023-01-01', endDate: '2024-09-01',
    tags: ['covid', 'rehabilitasyon'], keywords: ['long COVID', 'pulmonary rehabilitation'],
    sdgGoals: ['SKH-3'], ethicsRequired: true, ethicsApproved: true,
  },

  // ═══ EĞİTİM FAKÜLTESİ ═══
  {
    title: 'STEM Eğitimi Etkisi — Bölgesel Ölçüm',
    description: 'Hatay\'daki 40 ortaokulda STEM müfredatının kız öğrenci üniversite tercihlerine etkisinin 4 yıllık longitudinal çalışması.',
    type: 'bap', status: 'active', faculty: 'Eğitim Fakültesi', department: 'İlköğretim',
    budget: 165000, fundingSource: 'BAP', startDate: '2023-09-01', endDate: '2027-09-01',
    tags: ['stem', 'eğitim'], keywords: ['STEM education', 'gender equality', 'longitudinal study'],
    sdgGoals: ['SKH-4', 'SKH-5'], ownerEmail: 'ayse.demir@mku.edu.tr',
  },
  {
    title: 'Uzaktan Eğitimde Öğrenci Bağlılığı Analizi',
    description: 'LMS loglarından ve göz takibinden öğrenme bağlılığı modeli — deprem sonrası online eğitimin etkileri.',
    type: 'tubitak', status: 'completed', faculty: 'Eğitim Fakültesi', department: 'Eğitim Bilimleri',
    budget: 155000, fundingSource: 'TÜBİTAK 1001', startDate: '2022-08-01', endDate: '2024-08-01',
    tags: ['dijital eğitim', 'analitik'], keywords: ['learning analytics', 'engagement', 'remote education'],
    sdgGoals: ['SKH-4'], ownerEmail: 'ayse.demir@mku.edu.tr',
  },

  // ═══ GÜZEL SANATLAR ═══
  {
    title: 'Hatay Mozaik Motiflerinin Dijital Arşivi',
    description: 'Antakya mozaik sanatının desen veritabanı ve çağdaş tasarımcılar için desen üreteç algoritması.',
    type: 'bap', status: 'active', faculty: 'Güzel Sanatlar, Tasarım ve Mimarlık Fakültesi', department: 'Grafik Tasarım',
    budget: 110000, fundingSource: 'BAP', startDate: '2024-02-01', endDate: '2025-12-01',
    tags: ['tasarım', 'dijital miras'], keywords: ['mosaic', 'pattern design', 'cultural archive'],
    sdgGoals: ['SKH-11'],
  },
  {
    title: 'Tarihi Yapılarda Parametrik Restorasyon Modellemesi',
    description: 'Deprem sonrası hasarlı dini yapılar için jenerik geometri tabanlı rekonstrüksiyon metodolojisi.',
    type: 'eu', status: 'active', faculty: 'Güzel Sanatlar, Tasarım ve Mimarlık Fakültesi', department: 'Mimarlık',
    budget: 750000, fundingSource: 'Horizon Europe MSCA', startDate: '2024-09-01', endDate: '2027-09-01',
    tags: ['mimarlık', 'restorasyon'], keywords: ['parametric design', 'heritage restoration', 'BIM'],
    sdgGoals: ['SKH-11'],
  },

  // ═══ SU ÜRÜNLERİ ═══
  {
    title: 'İskenderun Körfezi Mikroplastik İzleme Ağı',
    description: 'Sahil boyunca 20 istasyonda aylık mikroplastik ölçümü ve deniz canlılarında biyoakümülasyon çalışması.',
    type: 'tubitak', status: 'active', faculty: 'Su Ürünleri Fakültesi', department: 'Su Ürünleri',
    budget: 295000, fundingSource: 'TÜBİTAK 1001', startDate: '2024-04-01', endDate: '2027-04-01',
    tags: ['deniz kirliliği', 'mikroplastik'], keywords: ['microplastic', 'marine pollution', 'bioaccumulation'],
    sdgGoals: ['SKH-14', 'SKH-6'],
  },
  {
    title: 'Sürdürülebilir Akuaponik Üretim Sistemi',
    description: 'Kapalı devre akuaponik tesisi — çipura ve fesleğen entegre üretim modeli.',
    type: 'bap', status: 'active', faculty: 'Su Ürünleri Fakültesi', department: 'Su Ürünleri',
    budget: 140000, fundingSource: 'BAP', startDate: '2024-08-01', endDate: '2026-08-01',
    tags: ['akuaponik', 'sürdürülebilirlik'], keywords: ['aquaponics', 'sustainable agriculture', 'recirculating system'],
    sdgGoals: ['SKH-2', 'SKH-14', 'SKH-12'],
  },

  // ═══ ZİRAAT FAKÜLTESİ ═══
  {
    title: 'Tuza Dayanıklı Domates Islahı',
    description: 'Hatay ovası tuzluluk sorununa karşı marker-destekli seleksiyon ile yeni domates genotipleri.',
    projectText: 'SSR marker taraması, doku kültürü ve sera denemeleri. Islah edilen hatlar Tarım Bakanlığı tescil sürecine alınacak.',
    type: 'tubitak', status: 'active', faculty: 'Ziraat Fakültesi', department: 'Tarla Bitkileri',
    budget: 410000, fundingSource: 'TÜBİTAK 1001', startDate: '2024-01-01', endDate: '2027-01-01',
    tags: ['bitki ıslahı', 'tuzluluk'], keywords: ['plant breeding', 'salt tolerance', 'marker-assisted selection', 'tomato'],
    sdgGoals: ['SKH-2', 'SKH-13'],
  },
  {
    title: 'Zeytin Tozlanmasında Arıcılık Etkileri',
    description: 'Hatay zeytinliklerinde arıcılık ile verim ilişkisi — pollen transferi çalışması.',
    type: 'tubitak', status: 'completed', faculty: 'Ziraat Fakültesi', department: 'Zootekni',
    budget: 175000, fundingSource: 'TÜBİTAK 1001', startDate: '2021-03-01', endDate: '2024-03-01',
    tags: ['arıcılık', 'zeytin'], keywords: ['pollination', 'beekeeping', 'olive yield'],
    sdgGoals: ['SKH-2', 'SKH-15'],
  },
  {
    title: 'İklim Değişikliği Vejetasyon Haritası',
    description: 'Hatay için 30 yıllık Landsat/MODIS ile vejetasyon değişim analizi ve gelecek projeksiyonları.',
    type: 'eu', status: 'active', faculty: 'Ziraat Fakültesi', department: 'Toprak Bilimi ve Bitki Besleme',
    budget: 620000, fundingSource: 'Horizon Europe', startDate: '2024-03-01', endDate: '2027-03-01',
    tags: ['uzaktan algılama', 'iklim'], keywords: ['remote sensing', 'climate change', 'NDVI', 'vegetation'],
    sdgGoals: ['SKH-13', 'SKH-15'],
  },

  // ═══ TEKNOLOJİ FAKÜLTESİ ═══
  {
    title: 'Yenilenebilir Enerji Mikroşebeke Yönetimi',
    description: 'Güneş + rüzgar + akü hibrit mikroşebeke için tahmin destekli optimizasyon algoritması.',
    type: 'tubitak', status: 'active', faculty: 'Teknoloji Fakültesi', department: 'Elektrik Elektronik Mühendisliği',
    budget: 380000, fundingSource: 'TÜBİTAK 1001', startDate: '2024-07-01', endDate: '2026-07-01',
    tags: ['yenilenebilir enerji', 'optimizasyon'], keywords: ['microgrid', 'renewable energy', 'energy storage'],
    sdgGoals: ['SKH-7', 'SKH-13'],
  },
  {
    title: 'Otomotiv Sensör Prototipleme Merkezi',
    description: 'ADAS sensörleri için karakteristik test laboratuvarı — Hatay OSB sanayi işbirliği.',
    type: 'industry', status: 'pending', faculty: 'Teknoloji Fakültesi', department: 'Mekatronik Mühendisliği',
    budget: 950000, fundingSource: 'Sanayi İşbirliği', startDate: '2025-01-01', endDate: '2027-06-01',
    tags: ['otomotiv', 'sensör'], keywords: ['ADAS', 'LiDAR', 'automotive sensors'],
    sdgGoals: ['SKH-9'], ipStatus: 'pending',
  },
];
