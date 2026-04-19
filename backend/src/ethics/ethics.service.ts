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
  }) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return this.ruleBasedAnalysis(data);

    const prompt = 'Sen bir arastirma etigi uzmanisın. Asagidaki projeyi degerlendir.\n\n' +
      'PROJE: ' + data.title + ' (' + data.type + ')\n' +
      'OZET: ' + (data.description || '(yok)') + '\n' +
      'PROJE METNI: ' + (data.projectText || '(yok)') + '\n\n' +
      'Kontrol et:\n' +
      '1. Insan katilimci/denek var mi? (anket, gorusme, hasta, gonullu)\n' +
      '2. Hayvan deneyi var mi?\n' +
      '3. Kisisel/hassas veri var mi? (saglik, kimlik, biyometrik)\n' +
      '4. Savunmasiz gruplar var mi? (cocuk, hasta, hamile)\n' +
      '5. Tibbi/klinik prosedur var mi?\n' +
      '6. Gizlilik riski var mi?\n\n' +
      'SADECE bu JSON formatinda yanit ver:\n' +
      '{"required":true,"riskScore":75,"reasons":["neden1"],"recommendation":"aciklama"}';

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return this.ruleBasedAnalysis(data);
      const d = await res.json();
      const parsed = JSON.parse((d?.content?.[0]?.text || '').replace(/```json|```/g, '').trim());
      return {
        required: !!parsed.required,
        riskScore: Math.max(0, Math.min(100, +parsed.riskScore || 0)),
        reasons: parsed.reasons || [],
        recommendation: parsed.recommendation || '',
      };
    } catch {
      return this.ruleBasedAnalysis(data);
    }
  }

  private ruleBasedAnalysis(data: any) {
    const text = [data.title, data.description, data.projectText].join(' ').toLowerCase();
    const checks: Array<[string[], string]> = [
      [['insan', 'denek', 'katilimci', 'gonullu', 'anket', 'gorusme', 'hasta'], 'Insan katilimci iceriyor'],
      [['hayvan', 'fare', 'sicran', 'kobay'], 'Hayvan deneyi iceriyor'],
      [['kisisel veri', 'saglik verisi', 'kimlik', 'biyometrik'], 'Kisisel/hassas veri isleniyor'],
      [['cocuk', 'hamile', 'engelli', 'mahkum'], 'Savunmasiz grup iceriyor'],
      [['kan', 'biyopsi', 'ilac deneme', 'klinik'], 'Tibbi prosedur iceriyor'],
    ];
    const found: string[] = [];
    checks.forEach(([kws, label]) => { if (kws.some(k => text.includes(k))) found.push(label); });
    const score = Math.min(100, found.length * 20);
    return {
      required: score > 0,
      riskScore: score,
      reasons: found,
      recommendation: score >= 40
        ? 'Etik kurul onayi gereklidir.'
        : score > 0
        ? 'Etik degerlendirme onerilir.'
        : 'Standart kurallar yeterli.',
    };
  }

  // FIX #4: Mevcut inceleme varsa projectText degismisse yeniden analiz yap
  async initiateReview(projectId: string, forceReanalyze = false) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new Error('Proje bulunamadi');

    const existing = await this.reviewRepo.findOne({ where: { projectId } });

    // FIX #4: Karar verilmemisse veya forceReanalyze ise yeniden analiz yap
    if (existing && !forceReanalyze && existing.status !== 'pending') {
      return existing;
    }

    const analysis = await this.analyzeWithAi({
      projectId,
      title: project.title,
      description: project.description || '',
      projectText: (project as any).projectText || '',
      type: project.type,
    });

    let review: EthicsReview;
    if (existing) {
      // Mevcut incelemeyi guncelle
      existing.aiEthicsRequired = analysis.required;
      existing.aiEthicsReason = [...analysis.reasons, analysis.recommendation].filter(Boolean).join('. ');
      existing.aiRiskScore = analysis.riskScore;
      // FIX #5: pending'e al ki kurul yeniden karar verebilsin
      if (forceReanalyze) existing.status = analysis.required ? 'pending' : 'not_required';
      review = await this.reviewRepo.save(existing);
    } else {
      const newReview = this.reviewRepo.create({
        projectId,
        aiEthicsRequired: analysis.required,
        aiEthicsReason: [...analysis.reasons, analysis.recommendation].filter(Boolean).join('. '),
        aiRiskScore: analysis.riskScore,
        status: analysis.required ? 'pending' : 'not_required',
      });
      review = await this.reviewRepo.save(newReview);
    }

    await this.projectRepo.update(projectId, { ethicsRequired: analysis.required } as any);

    // Etik kurul uyelerine bildirim (sadece ilk kez veya reanaliz)
    if (analysis.required) {
      try {
        const members = await this.userRepo.createQueryBuilder('u')
          .innerJoin('u.role', 'r')
          .where("LOWER(r.name) LIKE '%etik%'")
          .getMany();
        for (const m of members) {
          await this.notificationsService.create({
            userId: m.id,
            title: 'Etik Inceleme Bekleniyor',
            message: project.title + ' — Risk: ' + analysis.riskScore + '/100',
            type: 'warning',
            link: '/ethics',
          }).catch(() => {});
        }
      } catch {}
    }

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
