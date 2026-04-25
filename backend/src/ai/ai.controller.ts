import { Controller, Post, Get, Body, Param, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException, HttpException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { YoksisService } from './yoksis.service';
import { AiComplianceService } from './ai-compliance.service';
import { AiAssistantService, AssistantRequest } from './ai-assistant.service';

@SkipThrottle()
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly yoksisService: YoksisService,
    private readonly complianceService: AiComplianceService,
    private readonly assistantService: AiAssistantService,
  ) {}

  // ── ASİSTAN SOHBETİ (konsolide) ──────────────────────────────
  @Post('assistant')
  async assistant(@Body() body: AssistantRequest, @Request() req: any) {
    return this.assistantService.chat(req.user?.userId, body);
  }

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
    if (!apiKey) throw new ServiceUnavailableException('ANTHROPIC_API_KEY tanımlı değil.');
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-haiku-4-5-20251001', max_tokens: dto.maxTokens || 1000, system: dto.system, messages: [{ role: 'user', content: dto.userContent }] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new HttpException(
          'Anthropic API hatası: ' + ((err as any)?.error?.message || res.status),
          HttpStatus.BAD_GATEWAY,
        );
      }
      const data = await res.json();
      return { text: data?.content?.find((b: any) => b.type === 'text')?.text || '' };
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(e?.message || 'Bağlantı hatası', HttpStatus.BAD_GATEWAY);
    }
  }

  // ── YILLIK RAPOR NARRATİVE ÜRETİMİ ──────────────────────────────
  /**
   * Rapor için profesyonel önsöz + değerlendirme paragrafları üretir.
   * Bütün rapor verisi özet olarak geçilir - 3-4 paragraf çıktı verir.
   */
  @Post('annual-report-narrative')
  async annualReportNarrative(@Body() body: {
    year: number;
    siteName: string;
    totalProjects?: number;
    activeProjects?: number;
    completedProjects?: number;
    cancelledProjects?: number;
    successRate?: number;
    totalBudget?: number;
    totalPublications?: number;
    totalCitations?: number;
    hIndex?: number;
    avgFwci?: number | null;
    top1PctCount?: number;
    top10PctCount?: number;
    openAccessRatio?: number;
    q1Count?: number;
    quartileTotal?: number;
    sdgCovered?: number;
    internationalCoauthorRatio?: number;
    pubGrowthPct?: number | null;
    topFaculty?: string;
    peerRank?: { mkuWorks?: number; peerCount?: number; position?: number };
  }) {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    // Fallback - API yoksa basit özet üret
    if (!apiKey) {
      return { preface: this.fallbackNarrative(body), evaluation: '', outlook: '' };
    }

    const dataSummary = `
YIL: ${body.year}
KURUM: ${body.siteName}

PROJE PORTFÖYÜ:
- Toplam proje: ${body.totalProjects || 0}
- Aktif: ${body.activeProjects || 0}, Tamamlanan: ${body.completedProjects || 0}
- Başarı oranı: %${body.successRate || 0}
- Toplam bütçe: ${body.totalBudget ? (body.totalBudget / 1_000_000).toFixed(1) + 'M TL' : 'yok'}

AKADEMİK ÇIKTI:
- Yayın: ${body.totalPublications || 0}, Atıf: ${body.totalCitations || 0}
- h-index: ${body.hIndex || 0}
- Ortalama FWCI: ${body.avgFwci !== null && body.avgFwci !== undefined ? body.avgFwci : 'veri yok'}
- Top 1% yayın: ${body.top1PctCount || 0} (toplam ${body.totalPublications ? Math.round(((body.top1PctCount || 0) / body.totalPublications) * 1000) / 10 : 0}%)
- Top 10% yayın: ${body.top10PctCount || 0}
- Q1 dergilerde yayın: ${body.q1Count || 0} (kalite bilinen ${body.quartileTotal || 0} yayının %${body.quartileTotal ? Math.round(((body.q1Count || 0) / body.quartileTotal) * 100) : 0}'i)
- Açık erişim oranı: %${body.openAccessRatio || 0}

ULUSLARARASI:
- Yurt dışı ortak yazarlı yayın: %${body.internationalCoauthorRatio || 0}
- Yıllık yayın değişimi: ${body.pubGrowthPct === null || body.pubGrowthPct === undefined ? 'hesaplanamadı' : (body.pubGrowthPct >= 0 ? '+' : '') + body.pubGrowthPct + '%'}

KURUMSAL:
- SDG kapsamı: ${body.sdgCovered || 0}/17
- En başarılı fakülte: ${body.topFaculty || '-'}
${body.peerRank?.peerCount ? `- Peer üniversiteler arasında yayın sırası: ${body.peerRank.position}/${body.peerRank.peerCount}` : ''}
    `.trim();

    const prompt = `Sen kurumsal bibliyometri raporu için kıdemli bir analist rolündesin - üniversite rektörlüğü ve senato seviyesinde okunacak bir belge yazıyorsun. Verilen kurumun ${body.year} yılına dair raporu için 3 bölümlük profesyonel metin üret.

GÖRÜNEN VERİ:
${dataSummary}

YAZIM KURALLARI:
• Türkçe, resmi ama mekanik değil - akıcı bir analist tonu.
• KESİNLİKLE "önemli bir yıl oldu", "büyük başarı" gibi klişe ifadeler yok.
• Her iddiayı spesifik sayıyla destekle. ("FWCI 1.2 ile alan ortalamasının üstünde", "%${body.internationalCoauthorRatio} uluslararası ortaklık oranı" gibi).
• Güçlü yönlerle zayıf yönleri dengeli tut. Örtbas yapma - veri eksikse "şu metrik için yeterli veri yok" de.
• FWCI 1.0 altındaysa, top 1% sıfırsa, uluslararası oran düşükse bunu açıkça yorumla ve neden olabileceğini tahmin et.
• Spesifik karşılaştırma yap: peer üniversiteler var mı, var ise konumunu söyle.
• Rakamları havada bırakma: "%72 başarı" değil "%72 - kararlaşan projelerin büyük çoğunluğu tamamlanıyor, ancak ${body.totalProjects ? Math.round(((body.cancelledProjects || 0) / body.totalProjects) * 100) : 0}% iptal oranı da mevcut".

3 BÖLÜMÜN İÇERİĞİ:

1. PREFACE (önsöz): ~130 kelime, 2 paragraf. Kurumsal bakış açısıyla yılın özetini anlatan bir önsöz - TTO/rektörlük imzasından çıkmış gibi hissettirsin. İlk paragrafta yılın bağlamı (hangi büyüme alanı dikkat çekti), ikincide araştırma politikasına dair kısa bir mesaj.

2. EVALUATION (analitik değerlendirme): ~200 kelime, 3 paragraf.
   - 1. paragraf: Üretkenlik ve büyüme analizi (yayın sayısı, atıf birikimi, pubGrowthPct). Pozitif VEYA negatifse neden olabileceği.
   - 2. paragraf: Kalite ve etki analizi (FWCI, Top 1%/10%, Q1 payı, OA oranı). Zayıf göstergeleri açıkça söyle.
   - 3. paragraf: Uluslararasılaşma ve portföy çeşitliliği (intl ortaklık, ülke sayısı, SDG kapsamı). Peer karşılaştırma varsa yorumla.

3. OUTLOOK (gelecek): ~90 kelime, 1 paragraf. Gerçekçi somut hedefler - "çok yayın yapalım" gibi değil, "FWCI'yi 1.X seviyesine çekmek için yüksek IF'li dergilerde 2-3 stratejik yayın hedeflenebilir" gibi. Mevcut zayıf noktaları telafi edecek öneriler.

TONU HATIRLA: Bu rapor dekan ve rektöre gidecek. Klişe veya reklam dili DEĞİL - kararlı analitik dil kullan.

SADECE JSON döndür (markdown yok, kod bloğu yok):
{
  "preface": "...",
  "evaluation": "...",
  "outlook": "..."
}`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: process.env.AI_MODEL || 'claude-haiku-4-5-20251001',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        return { preface: this.fallbackNarrative(body), evaluation: '', outlook: '' };
      }
      const data = await res.json();
      const text = data?.content?.[0]?.text || '';
      try {
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
        return {
          preface: parsed.preface || '',
          evaluation: parsed.evaluation || '',
          outlook: parsed.outlook || '',
        };
      } catch {
        // JSON parse başarısızsa ham metni preface olarak kullan
        return { preface: text.slice(0, 600), evaluation: '', outlook: '' };
      }
    } catch {
      return { preface: this.fallbackNarrative(body), evaluation: '', outlook: '' };
    }
  }

  private fallbackNarrative(body: any): string {
    return `${body.siteName} ${body.year} yılında toplam ${body.totalProjects || 0} projeyi hayata geçirdi ve ` +
      `${body.totalPublications || 0} yayın ile akademik çıktısını genişletmeye devam etti. ` +
      `Kararlaşan projelerdeki %${body.successRate || 0} başarı oranı, kurumumuzun araştırma yönetimindeki olgunluğunun bir göstergesidir.`;
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
        body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-haiku-4-5-20251001', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
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

  // ── BELGEDEN METİN ÇIKAR ─────────────────────────────────────
  @Post('extract-text')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } }))
  async extractText(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Dosya yüklenmedi');
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    try {
      if (ext === 'txt') {
        // Encoding tespiti - UTF-8, Latin-1, Windows-1254 (Türkçe) dene
        let text = file.buffer.toString('utf-8');
        // Bozuk karakter tespiti - yaygın Türkçe harf bozulması
        if (text.includes('Ã¼') || text.includes('Ã§') || text.includes('Ä±')) {
          // UTF-8 yanlış decode - Latin-1 ile dene
          text = file.buffer.toString('latin1');
        }
        return { text: text.trim() };
      }

      if (ext === 'pdf') {
        // DOMMatrix polyfill - pdf-parse/pdf.js Node.js'de bazı browser API'lerini bekliyor
        const g = global as any;
        if (!g.DOMMatrix) g.DOMMatrix = class { constructor() {} static fromFloat64Array() { return new g.DOMMatrix(); } };
        if (!g.DOMPoint)  g.DOMPoint  = class { constructor() {} };
        if (!g.DOMRect)   g.DOMRect   = class { constructor() {} };
        if (!g.Path2D)    g.Path2D    = class { constructor() {} };
        if (!g.ImageData) g.ImageData = class { constructor() {} };

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfParse = require('pdf-parse');
        let data: any;
        try {
          data = await pdfParse(file.buffer, { max: 30 });
        } catch {
          try { data = await pdfParse(file.buffer); } catch (e2: any) {
            return { text: '', error: 'PDF okunamadı: ' + (e2?.message || 'Bilinmeyen hata') };
          }
        }
        let text = (data?.text || '').trim();

        if (!text || text.length < 30) {
          return {
            text: '',
            error: 'Bu PDF dosyasından metin çıkarılamadı. Dosya taranmış (görüntü) veya şifreli olabilir. Lütfen metin tabanlı PDF veya .docx yükleyin.',
            pageCount: data?.numpages || 0,
          };
        }

        // Türkçe karakter düzeltme - bazı PDF encoder'lar yanlış kodlar
        text = text
          .replace(/\uFFFD/g, ' ')
          .replace(/ý/g, 'ı').replace(/þ/g, 'ş').replace(/ð/g, 'ğ')
          .replace(/Ý/g, 'İ').replace(/Þ/g, 'Ş').replace(/Ð/g, 'Ğ')
          .replace(/\u00fd/g, 'ı').replace(/\u00fe/g, 'ş').replace(/\u00f0/g, 'ğ')
          .replace(/\s{3,}/g, '\n\n').trim();

        return { text, pageCount: data?.numpages || 0, charCount: text.length };
      }

      if (ext === 'docx') {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        const text = (result.value || '').trim();
        if (!text) return { text: '', error: 'Word belgesinden metin çıkarılamadı.' };
        return { text, charCount: text.length };
      }

      return { text: '', error: 'Desteklenmeyen dosya türü. Desteklenen formatlar: .txt, .pdf, .docx' };
    } catch (e: any) {
      return { text: '', error: 'Metin çıkarma hatası: ' + (e?.message || 'Bilinmeyen hata') };
    }
  }

  // ── SKH ÖNERİSİ ──────────────────────────────────────────────
  @Post('suggest-sdg')
  async suggestSdg(@Body() dto: { title: string; description: string; projectText?: string }) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // API yoksa kural tabanlı basit öneri
      return { suggestions: [] };
    }
    try {
      const prompt = `Aşağıdaki akademik proje için BM Sürdürülebilir Kalkınma Hedefleri (SKH) öner.

Proje: ${dto.title}
Özet: ${dto.description || ''}
${dto.projectText ? 'Metin: ' + dto.projectText.substring(0, 500) : ''}

Mevcut SKH kodları: SKH-1, SKH-2, SKH-3, SKH-4, SKH-5, SKH-6, SKH-7, SKH-8, SKH-9, SKH-10, SKH-11, SKH-12, SKH-13, SKH-14, SKH-15, SKH-16, SKH-17

SADECE JSON döndür, başka hiçbir şey yazma:
{"suggestions":["SKH-X","SKH-Y"],"reasons":{"SKH-X":"kısa açıklama"}}`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-haiku-4-5-20251001', max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return { suggestions: [] };
      const data = await res.json();
      const text = data?.content?.find((b: any) => b.type === 'text')?.text || '';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      return { suggestions: parsed.suggestions || [], reasons: parsed.reasons || {} };
    } catch {
      return { suggestions: [] };
    }
  }

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
