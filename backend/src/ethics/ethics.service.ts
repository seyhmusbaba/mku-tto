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

  async analyzeWithAi(data: { projectId?: string; title: string; description: string; projectText: string; type: string }) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return this.ruleBasedAnalysis(data);

    const prompt = `Sen bir araştırma etiği uzmanısın. Aşağıdaki projeyi değerlendir.

PROJE: ${data.title} (${data.type})
ÖZET: ${data.description || '(yok)'}
PROJE METNİ: ${data.projectText || '(yok)'}

Kontrol et:
1. İnsan katılımcı/denek var mı? (anket, görüşme, hasta, gönüllü)
2. Hayvan deneyi var mı?
3. Kişisel/hassas veri var mı? (sağlık, kimlik, biyometrik)
4. Savunmasız gruplar var mı? (çocuk, hasta, hamile)
5. Tıbbi/klinik prosedür var mı?
6. Gizlilik riski var mı?

SADECE bu JSON formatında yanıt ver:
{"required":true,"riskScore":75,"reasons":["neden1"],"recommendation":"açıklama"}`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return this.ruleBasedAnalysis(data);
      const d = await res.json();
      const parsed = JSON.parse((d?.content?.[0]?.text || '').replace(/```json|```/g, '').trim());
      return { required: !!parsed.required, riskScore: Math.max(0, Math.min(100, +parsed.riskScore || 0)), reasons: parsed.reasons || [], recommendation: parsed.recommendation || '' };
    } catch { return this.ruleBasedAnalysis(data); }
  }

  private ruleBasedAnalysis(data: any) {
    const text = [data.title, data.description, data.projectText].join(' ').toLowerCase();
    const checks = [
      [['insan', 'denek', 'katılımcı', 'gönüllü', 'anket', 'görüşme', 'hasta'], 'İnsan katılımcı içeriyor'],
      [['hayvan', 'fare', 'sıçan', 'kobay'], 'Hayvan deneyi içeriyor'],
      [['kişisel veri', 'sağlık verisi', 'kimlik', 'biyometrik'], 'Kişisel/hassas veri işleniyor'],
      [['çocuk', 'hamile', 'engelli', 'mahkum'], 'Savunmasız grup içeriyor'],
      [['kan', 'biyopsi', 'ilaç deneme', 'klinik'], 'Tıbbi prosedür içeriyor'],
    ] as any[];
    const found: string[] = [];
    checks.forEach(([kws, label]: any) => { if (kws.some((k: string) => text.includes(k))) found.push(label); });
    const score = Math.min(100, found.length * 20);
    return { required: score > 0, riskScore: score, reasons: found, recommendation: score >= 40 ? 'Etik kurul onayı gereklidir.' : score > 0 ? 'Etik değerlendirme önerilir.' : 'Standart kurallar yeterli.' };
  }

  async initiateReview(projectId: string) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new Error('Proje bulunamadı');

    const existing = await this.reviewRepo.findOne({ where: { projectId } });
    if (existing) return existing;

    const analysis = await this.analyzeWithAi({
      projectId, title: project.title,
      description: project.description || '',
      projectText: (project as any).projectText || '',
      type: project.type,
    });

    const review = this.reviewRepo.create({
      projectId,
      aiEthicsRequired: analysis.required,
      aiEthicsReason: [...analysis.reasons, analysis.recommendation].filter(Boolean).join('. '),
      aiRiskScore: analysis.riskScore,
      status: analysis.required ? 'pending' : 'not_required',
    });
    const saved = await this.reviewRepo.save(review);

    await this.projectRepo.update(projectId, { ethicsRequired: analysis.required } as any);

    if (analysis.required) {
      try {
        const members = await this.userRepo.createQueryBuilder('u').innerJoin('u.role', 'r').where("LOWER(r.name) LIKE '%etik%'").getMany();
        for (const m of members) {
          await this.notificationsService.create({ userId: m.id, title: '🔬 Etik İnceleme Bekleniyor', message: project.title + ' — Risk: ' + analysis.riskScore + '/100', type: 'warning', link: '/ethics' }).catch(() => {});
        }
      } catch {}
    }

    return saved;
  }

  async submitDecision(reviewId: string, reviewerId: string, decision: 'approved' | 'rejected', note: string, approvalNumber?: string) {
    const review = await this.reviewRepo.findOne({ where: { id: reviewId }, relations: ['project'] });
    if (!review) throw new Error('İnceleme bulunamadı');

    review.status = decision;
    review.reviewerId = reviewerId;
    review.reviewNote = note;
    review.approvalNumber = approvalNumber || null;
    review.reviewedAt = new Date();
    const saved = await this.reviewRepo.save(review);

    await this.projectRepo.update(review.projectId, { ethicsApproved: decision === 'approved', ethicsApprovalNo: approvalNumber || null } as any);

    if (review.project) {
      await this.notificationsService.create({
        userId: (review.project as any).ownerId,
        title: decision === 'approved' ? '✅ Etik Kurul Onayı Alındı' : '❌ Etik Kurul Başvurusu Reddedildi',
        message: review.project.title + ': ' + note,
        type: decision === 'approved' ? 'success' : 'warning',
        link: '/projects/' + review.projectId,
      }).catch(() => {});
    }

    return saved;
  }

  getPendingReviews() {
    return this.reviewRepo.find({ where: { status: 'pending' }, relations: ['project', 'project.owner'], order: { createdAt: 'DESC' } });
  }

  getReviewByProject(projectId: string) {
    return this.reviewRepo.findOne({ where: { projectId }, relations: ['reviewer'] });
  }

  getAllReviews() {
    return this.reviewRepo.find({ relations: ['project', 'project.owner', 'reviewer'], order: { createdAt: 'DESC' } });
  }
}
