import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { YoksisService } from './yoksis.service';
import { AiComplianceService } from './ai-compliance.service';

@SkipThrottle()
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly yoksisService: YoksisService,
    private readonly complianceService: AiComplianceService,
  ) {}

  // ── ORCID ────────────────────────────────────────────────────
  @Get('orcid/:id')
  async orcidLookup(@Param('id') id: string) {
    try {
      const headers = { Accept: 'application/json' };
      const [person, works, employments, educations] = await Promise.all([
        fetch('https://pub.orcid.org/v3.0/' + id + '/person', { headers }).then(r => r.json()),
        fetch('https://pub.orcid.org/v3.0/' + id + '/works', { headers }).then(r => r.json()),
        fetch('https://pub.orcid.org/v3.0/' + id + '/employments', { headers }).then(r => r.json()),
        fetch('https://pub.orcid.org/v3.0/' + id + '/educations', { headers }).then(r => r.json()),
      ]);
      const name = person?.name;
      const firstName = name?.['given-names']?.value || '';
      const lastName = name?.['family-name']?.value || '';
      const biography = person?.biography?.content || '';
      const keywords = person?.keywords?.keyword?.map((k: any) => k.content) || [];
      const workList = (works?.group || []).slice(0, 30).map((g: any) => {
        const ws = g['work-summary']?.[0];
        return {
          title: ws?.title?.title?.value || '',
          year: ws?.['publication-date']?.year?.value || '',
          type: ws?.type || '',
          journal: ws?.['journal-title']?.value || '',
          doi: ws?.['external-ids']?.['external-id']?.find((e: any) => e['external-id-type'] === 'doi')?.['external-id-value'] || '',
        };
      }).filter((w: any) => w.title);
      const employmentList = (employments?.['affiliation-group'] || []).map((g: any) => {
        const s = g.summaries?.[0]?.['employment-summary'];
        return { organization: s?.organization?.name || '', role: s?.['role-title'] || '', department: s?.['department-name'] || '', startYear: s?.['start-date']?.year?.value || '', endYear: s?.['end-date']?.year?.value || '', current: !s?.['end-date'] };
      }).filter((e: any) => e.organization);
      const educationList = (educations?.['affiliation-group'] || []).map((g: any) => {
        const s = g.summaries?.[0]?.['education-summary'];
        return { organization: s?.organization?.name || '', role: s?.['role-title'] || '', department: s?.['department-name'] || '', startYear: s?.['start-date']?.year?.value || '', endYear: s?.['end-date']?.year?.value || '' };
      }).filter((e: any) => e.organization);
      return { firstName, lastName, biography, keywords, works: workList, employments: employmentList, educations: educationList };
    } catch {
      return { error: 'ORCID verisi alınamadı' };
    }
  }

  // ── YZ METİN ÜRETİMİ ─────────────────────────────────────────
  @Post('generate')
  async generate(@Body() dto: { system: string; userContent: string; maxTokens?: number }) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { error: 'ANTHROPIC_API_KEY tanımlı değil.' };
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: dto.maxTokens || 1000, system: dto.system, messages: [{ role: 'user', content: dto.userContent }] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { error: 'Anthropic API hatası: ' + ((err as any)?.error?.message || res.status) };
      }
      const data = await res.json();
      return { text: data?.content?.find((b: any) => b.type === 'text')?.text || '' };
    } catch (e: any) {
      return { error: e.message || 'Bağlantı hatası' };
    }
  }

  // ── YZ PROJE UYGUNLUK KONTROLÜ ────────────────────────────────
  @Post('check-compliance')
  async checkCompliance(@Body() body: { title: string; description: string; projectText: string; type: string; ethicsRequired?: boolean }) {
    return this.complianceService.checkProjectCompliance(body);
  }

  // ── YZ BELGE İNCELEMESİ ───────────────────────────────────────
  @Post('review-documents')
  async reviewDocuments(@Body() body: {
    projectTitle: string;
    projectType: string;
    documents: Array<{ name: string; type: string; size: number }>;
    ipStatus?: string;
    ethicsRequired?: boolean;
    ethicsApproved?: boolean;
  }) {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    // API yoksa temel kontrol yap
    if (!apiKey) {
      return this.basicDocumentCheck(body);
    }

    const docList = body.documents.map(d => `- ${d.name} (${d.type}, ${Math.round(d.size / 1024)}KB)`).join('\n');

    const prompt = `Sen bir akademik proje belge denetçisisin. Aşağıdaki proje için yüklenen belgeleri değerlendir.

PROJE: ${body.projectTitle} (${body.projectType})
Fikri Mülkiyet Durumu: ${body.ipStatus || 'none'}
Etik Kurul Gerekli mi: ${body.ethicsRequired ? 'Evet' : 'Hayır'}
Etik Onaylandı mı: ${body.ethicsApproved ? 'Evet' : 'Hayır'}

YÜKLENEN BELGELER:
${docList || '(Henüz belge yüklenmemiş)'}

Şu açılardan değerlendir:
1. Eksik kritik belgeler var mı? (IP belgesi, etik kurul onayı, kabul belgesi vb.)
2. Belge adları proje ile tutarlı mı?
3. Proje türüne göre olması gereken ama olmayan belgeler var mı?

SADECE JSON döndür:
{
  "status": "ok" | "warning" | "error",
  "summary": "Kısa değerlendirme",
  "issues": [{"severity": "error"|"warning"|"info", "message": "Sorun açıklaması"}],
  "missingDocuments": ["Eksik belge 1", "Eksik belge 2"],
  "recommendations": ["Öneri 1"]
}`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) return this.basicDocumentCheck(body);
      const data = await res.json();
      const text = data?.content?.[0]?.text || '';
      return JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      return this.basicDocumentCheck(body);
    }
  }

  private basicDocumentCheck(body: any) {
    const issues: any[] = [];
    const missing: string[] = [];

    if (body.ipStatus && body.ipStatus !== 'none') {
      const hasIpDoc = body.documents?.some((d: any) =>
        d.name.toLowerCase().includes('patent') ||
        d.name.toLowerCase().includes('fikri') ||
        d.name.toLowerCase().includes('tescil') ||
        d.type === 'ip'
      );
      if (!hasIpDoc) {
        missing.push('Fikri mülkiyet tescil/başvuru belgesi');
        issues.push({ severity: 'warning', message: 'Fikri mülkiyet durumu belirtilmiş ancak ilgili belge yüklenmemiş' });
      }
    }

    if (body.ethicsRequired && body.ethicsApproved) {
      const hasEthicsDoc = body.documents?.some((d: any) =>
        d.name.toLowerCase().includes('etik') ||
        d.type === 'ethics'
      );
      if (!hasEthicsDoc) {
        missing.push('Etik kurul onay belgesi');
        issues.push({ severity: 'warning', message: 'Etik kurul onayı işaretlenmiş ancak onay belgesi yüklenmemiş' });
      }
    }

    if (!body.documents || body.documents.length === 0) {
      issues.push({ severity: 'info', message: 'Henüz hiç belge yüklenmemiş' });
    }

    return {
      status: issues.some(i => i.severity === 'error') ? 'error' : issues.some(i => i.severity === 'warning') ? 'warning' : 'ok',
      summary: issues.length === 0 ? 'Belge durumu iyi görünüyor' : 'Bazı eksiklikler tespit edildi',
      issues,
      missingDocuments: missing,
      recommendations: missing.length > 0 ? ['Eksik belgeleri Belgeler sekmesinden yükleyin'] : [],
    };
  }

  // ── YÖKSİS ───────────────────────────────────────────────────
  @Get('yoksis/status')
  yoksisStatus() { return { configured: this.yoksisService.isReady() }; }

  @Post('yoksis/sync')
  async yoksisSync(@Body() body: { tcNo: string }, @Request() req: any) {
    return this.yoksisService.syncProfile(req.user.userId, body.tcNo);
  }

  @Post('yoksis/projects')
  async yoksisProjects(@Body() body: { tcNo: string }) {
    return this.yoksisService.getAcademicProjects(body.tcNo);
  }
}
