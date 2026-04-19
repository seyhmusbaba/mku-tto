import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { CrossrefService } from './crossref.service';
import { ScimagoService } from './scimago.service';
import { OpenAccessService } from './open-access.service';
import { WosService } from './wos.service';
import { PatentService } from './patent.service';
import { OpenAlexService } from './openalex.service';
import { DergiparkService } from './dergipark.service';
import { CordisService } from './cordis.service';

/**
 * Entegrasyon durum endpoint'i — AUTH GEREKTİRMEZ.
 * Sadece "hangi servis yapılandırılmış" bilgisi döndürür. Hassas veri yok,
 * operasyonel transparency için public bırakılmıştır.
 *
 * Diğer /integrations/* endpoint'leri JWT guard'lı.
 */
@SkipThrottle()
@Controller('integrations')
export class IntegrationsStatusController {
  constructor(
    private readonly crossref: CrossrefService,
    private readonly scimago: ScimagoService,
    private readonly oa: OpenAccessService,
    private readonly wos: WosService,
    private readonly patent: PatentService,
    private readonly openalex: OpenAlexService,
    private readonly dergipark: DergiparkService,
    private readonly cordis: CordisService,
  ) {}

  @Get('status')
  getStatus() {
    return {
      crossref:        { configured: this.crossref.isConfigured(), requiresKey: false, note: 'CROSSREF_MAILTO email için önerilir (polite pool)' },
      scimago:         { configured: this.scimago.isConfigured(),  requiresKey: false, journalCount: this.scimago.getSize(), note: 'Kurumsal CSV — başlangıçta otomatik yüklenir' },
      openAccess:      { configured: this.oa.isConfigured(),       requiresKey: false, note: 'Unpaywall + DOAJ, UNPAYWALL_MAILTO önerilir' },
      scopus:          { configured: !!process.env.SCOPUS_API_KEY, requiresKey: true,  note: 'SCOPUS_API_KEY' },
      wos:             { configured: this.wos.isConfigured(),      requiresKey: true,  note: 'WOS_API_KEY Clarivate Developer Portal' },
      patent:          { configured: this.patent.isConfigured(),   requiresKey: true,  note: 'EPO OPS (TR patentleri dahil) — EPO_CONSUMER_KEY + EPO_CONSUMER_SECRET' },
      openalex:        { configured: this.openalex.isConfigured(), requiresKey: false, note: 'Ücretsiz, OPENALEX_MAILTO önerilir' },
      dergipark:       { configured: this.dergipark.isConfigured(),requiresKey: false, note: 'Türk akademik dergileri (OAI-PMH)' },
      cordis:          { configured: this.cordis.isConfigured(),   requiresKey: false, note: 'AB açık veri — Horizon Europe, H2020, FP7' },
      pubmed:          { configured: true,                         requiresKey: false, note: 'NCBI E-utilities — PUBMED_MAILTO önerilir' },
      arxiv:           { configured: true,                         requiresKey: false, note: 'STEM preprint' },
      semanticScholar: { configured: true,                         requiresKey: false, note: 'SEMANTIC_SCHOLAR_KEY opsiyonel (yüksek rate için)' },
    };
  }
}
