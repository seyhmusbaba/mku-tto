import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EthicsReview } from './ethics-review.entity';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EthicsService {
  constructor(
    @InjectRepository(EthicsReview) private reviewRepo: Repository<EthicsReview>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private notificationsService: NotificationsService,
  ) {}

  async analyzeWithAi(data: {
    projectId?: string; title: string; description: string;
    projectText: string; type: string;
    faculty?: string; department?: string;
  }) {
    // Yüksek riskli fakülte/bölüm tespiti — bu alanlardaki projeler için
    // AI ne derse desin default ethics required = true.
    // Çünkü tıp/sağlık/sosyal bilimlerde neredeyse tüm çalışmalar etik kurul gerektirir.
    const HIGH_RISK_FACULTY_KEYWORDS = [
      'tıp', 'tip', 'sağlık', 'saglik', 'diş hekim', 'dis hekim',
      'veteriner', 'eczacı', 'eczaci', 'hemşire', 'hemsire',
      'psikoloji', 'sosyoloji', 'spor bilim', 'beden eğit', 'beden egit',
      'rehabilitasyon', 'fizyoterapi', 'ebelik',
    ];
    const facultyLower = (data.faculty || '').toLocaleLowerCase('tr-TR');
    const deptLower = (data.department || '').toLocaleLowerCase('tr-TR');
    const isHighRiskFaculty = HIGH_RISK_FACULTY_KEYWORDS.some(k =>
      facultyLower.includes(k) || deptLower.includes(k)
    );

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return this.ruleBasedAnalysis(data, isHighRiskFaculty);

    const prompt = 'Sen bir arastirma etigi uzmanisın. Asagidaki projeyi degerlendir.\n\n' +
      'PROJE: ' + data.title + ' (' + data.type + ')\n' +
      (data.faculty ? 'FAKÜLTE: ' + data.faculty + '\n' : '') +
      (data.department ? 'BÖLÜM: ' + data.department + '\n' : '') +
      'OZET: ' + (data.description || '(yok)') + '\n' +
      'PROJE METNI: ' + (data.projectText || '(yok)') + '\n\n' +
      'Kontrol et:\n' +
      '1. Insan katilimci/denek var mi? (anket, gorusme, hasta, gonullu, deneyim analizi)\n' +
      '2. Hayvan deneyi var mi?\n' +
      '3. Kisisel/hassas veri var mi? (saglik, kimlik, biyometrik, finansal, konum)\n' +
      '4. Savunmasiz gruplar var mi? (cocuk, hasta, hamile, mülteci, engelli, mahkum)\n' +
      '5. Tibbi/klinik prosedur var mi? (ilaç, cerrahi, tanı, tedavi testi)\n' +
      '6. Gizlilik/mahremiyet riski var mi?\n' +
      '7. Tıp / Sağlık Bilimleri / Veteriner / Diş Hekimliği / Eczacılık / Hemşirelik /\n' +
      '   Psikoloji / Sosyoloji / Spor / Rehabilitasyon / Fizyoterapi fakültesindeyse\n' +
      '   → neredeyse her durumda etik kurul gerekir.\n\n' +
      'KURAL — TEREDDÜTTE KALIRSAN required=true DÖN. Etik kurul gereklidir\n' +
      'demek, gereksizdir demekten her zaman daha güvenlidir.\n\n' +
      'SADECE bu JSON formatinda yanit ver:\n' +
      '{"required":true,"riskScore":75,"reasons":["neden1","neden2"],"recommendation":"aciklama"}';

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || 'claude-3-5-haiku-20241022',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return this.ruleBasedAnalysis(data, isHighRiskFaculty);
      const d = await res.json();
      const parsed = JSON.parse((d?.content?.[0]?.text || '').replace(/```json|```/g, '').trim());
      // High-risk fakülte override: AI "gerekmez" dese de zorla required=true
      const required = !!parsed.required || isHighRiskFaculty;
      const reasons = parsed.reasons || [];
      if (isHighRiskFaculty && !parsed.required) {
        reasons.push(`${data.faculty || data.department} — bu alanda araştırma etiği kurul onayı neredeyse her durumda gereklidir`);
      }
      return {
        required,
        riskScore: Math.max(isHighRiskFaculty ? 40 : 0, Math.min(100, +parsed.riskScore || 0)),
        reasons,
        recommendation: parsed.recommendation || (required ? 'Etik kurul onayı gereklidir.' : 'Standart kurallar yeterli.'),
      };
    } catch {
      return this.ruleBasedAnalysis(data, isHighRiskFaculty);
    }
  }

  private ruleBasedAnalysis(data: any, isHighRiskFaculty = false) {
    const text = [data.title, data.description, data.projectText].join(' ').toLocaleLowerCase('tr-TR');
    // Normalize Türkçe karakterler — "İnsan" "insan" ikisi de yakalansın
    const normalized = text
      .replace(/ı/g, 'i').replace(/İ/g, 'i')
      .replace(/ş/g, 's').replace(/Ş/g, 's')
      .replace(/ğ/g, 'g').replace(/Ğ/g, 'g')
      .replace(/ü/g, 'u').replace(/Ü/g, 'u')
      .replace(/ö/g, 'o').replace(/Ö/g, 'o')
      .replace(/ç/g, 'c').replace(/Ç/g, 'c');

    const checks: Array<[string[], string]> = [
      [['insan', 'denek', 'katilimci', 'gonullu', 'anket', 'gorusme', 'gorusu', 'bireyler', 'ogrenci'], 'İnsan katılımcı içeriyor'],
      [['hayvan', 'fare', 'sican', 'kobay', 'koyun', 'sigir', 'tavuk', 'in vivo'], 'Hayvan deneyi içeriyor'],
      [['kisisel veri', 'saglik verisi', 'hasta verisi', 'kimlik', 'biyometrik', 'finansal veri', 'konum verisi'], 'Kişisel/hassas veri işleniyor'],
      [['cocuk', 'hamile', 'engelli', 'mahkum', 'gocmen', 'multeci', 'yasli', 'ergen', 'bebek'], 'Savunmasız grup içeriyor'],
      [['kan', 'biyopsi', 'ilac deneme', 'klinik', 'cerrahi', 'tani', 'tedavi', 'muayene', 'ameliyat'], 'Tıbbi/klinik prosedür içeriyor'],
      [['mahrem', 'gizlilik', 'ozel hayat', 'anonim'], 'Mahremiyet/gizlilik boyutu var'],
      [['saglik', 'tedavi', 'rahatsizlik', 'hastalik', 'covid', 'epidemi', 'ilac'], 'Sağlık/tıp içeriği'],
    ];
    const found: string[] = [];
    checks.forEach(([kws, label]) => { if (kws.some(k => normalized.includes(k))) found.push(label); });

    if (isHighRiskFaculty) {
      found.unshift(`${data.faculty || data.department} — bu fakülte/bölümde araştırma etiği zorunludur`);
    }

    const score = Math.min(100, (isHighRiskFaculty ? 40 : 0) + found.length * 18);
    const required = score > 0 || isHighRiskFaculty;
    return {
      required,
      riskScore: score,
      reasons: found,
      recommendation: score >= 40
        ? 'Etik kurul onayı gereklidir.'
        : score > 0
        ? 'Etik değerlendirme önerilir.'
        : 'Standart kurallar yeterli — ancak şüpheniz varsa kurula danışın.',
    };
  }

  /**
   * Bir proje için etik kurul incelemesi başlat.
   *
   * POLİTİKA (kullanıcı kararı): AI analizi devre dışı — her yeni proje
   * OTOMATİK olarak etik kurul onayına gider. AI "gerekli değil" diyemez.
   *
   * Project.ethicsRequired her zaman true, EthicsReview.status her zaman 'pending'.
   * Kurul kararı (approved/rejected) sadece kurul üyesi tarafından değiştirilebilir.
   */
  async initiateReview(projectId: string, _forceReanalyze = false) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new Error('Proje bulunamadi');

    const existing = await this.reviewRepo.findOne({ where: { projectId } });

    // Kurul kararı zaten verilmişse (approved/rejected), yeniden pending yapma
    if (existing && existing.status !== 'pending' && existing.status !== 'not_required') {
      return existing;
    }

    let review: EthicsReview;
    if (existing) {
      existing.status = 'pending';
      existing.aiEthicsRequired = true;
      existing.aiEthicsReason = 'Kurumsal politika gereği tüm projeler etik kurul incelemesine alınır.';
      existing.aiRiskScore = 0;
      review = await this.reviewRepo.save(existing);
    } else {
      const newReview = this.reviewRepo.create({
        projectId,
        aiEthicsRequired: true,
        aiEthicsReason: 'Kurumsal politika gereği tüm projeler etik kurul incelemesine alınır.',
        aiRiskScore: 0,
        status: 'pending',
      });
      review = await this.reviewRepo.save(newReview);
    }

    // ethicsRequired her zaman true — AI override etmiyor
    await this.projectRepo.update(projectId, { ethicsRequired: true } as any);

    // Etik kurul üyelerine bildirim
    try {
      const members = await this.userRepo.createQueryBuilder('u')
        .innerJoin('u.role', 'r')
        .where("LOWER(r.name) LIKE '%etik%'")
        .getMany();
      for (const m of members) {
        await this.notificationsService.create({
          userId: m.id,
          title: 'Etik İnceleme Bekleniyor',
          message: project.title + ' — kurul incelemesine hazır',
          type: 'warning',
          link: '/ethics',
        }).catch(() => {});
      }
    } catch {}

    return review;
  }

  // FIX #5: reopen metodu eklendi
  async reopenReview(reviewId: string) {
    const review = await this.reviewRepo.findOne({ where: { id: reviewId } });
    if (!review) throw new Error('Inceleme bulunamadi');
    review.status = 'pending';
    review.reviewNote = null;
    review.reviewedAt = null;
    return this.reviewRepo.save(review);
  }

  async submitDecision(
    reviewId: string, reviewerId: string,
    decision: 'approved' | 'rejected',
    note: string, approvalNumber?: string,
  ) {
    const review = await this.reviewRepo.findOne({ where: { id: reviewId }, relations: ['project'] });
    if (!review) throw new Error('Inceleme bulunamadi');

    review.status = decision;
    review.reviewerId = reviewerId;
    review.reviewNote = note;
    review.approvalNumber = approvalNumber || null;
    review.reviewedAt = new Date();
    const saved = await this.reviewRepo.save(review);

    await this.projectRepo.update(review.projectId, {
      ethicsApproved: decision === 'approved',
      ethicsApprovalNo: approvalNumber || null,
    } as any);

    if (review.project) {
      await this.notificationsService.create({
        userId: (review.project as any).ownerId,
        title: decision === 'approved' ? 'Etik Kurul Onayi Alindi' : 'Etik Kurul Basvurusu Reddedildi',
        message: review.project.title + ': ' + note,
        type: decision === 'approved' ? 'success' : 'warning',
        link: '/projects/' + review.projectId,
      }).catch(() => {});
    }

    return saved;
  }

  getPendingReviews() {
    return this.reviewRepo.find({
      where: { status: 'pending' },
      relations: ['project', 'project.owner'],
      order: { createdAt: 'DESC' },
    });
  }

  getReviewByProject(projectId: string) {
    return this.reviewRepo.findOne({ where: { projectId }, relations: ['reviewer'] });
  }

  // FIX #12: Eski projeler icin - yoksa null don, hata verme
  async getReviewByProjectForUser(projectId: string, userId: string, roleName: string) {
    const r = (roleName || '').toLowerCase();
    const isEthics = r.includes('etik') || r.includes('admin') || r.includes('rekt') || r.includes('dekan');
    if (!isEthics) {
      const project = await this.projectRepo.findOne({ where: { id: projectId } });
      if (!project || project.ownerId !== userId) return null;
    }
    const review = await this.reviewRepo.findOne({ where: { projectId }, relations: ['reviewer'] });
    return review || null;
  }

  getAllReviews() {
    return this.reviewRepo.find({
      relations: ['project', 'project.owner', 'reviewer'],
      order: { createdAt: 'DESC' },
    });
  }
}
