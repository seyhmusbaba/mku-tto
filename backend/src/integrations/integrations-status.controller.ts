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
import { TrDizinService } from './trdizin.service';

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
    private readonly trdizin: TrDizinService,
  ) {}

  @Get('trdizin/diagnostic')
  async trdizinDiagnostic() {
    return this.trdizin.diagnostic();
  }

  @Get('trdizin/test')
  async trdizinLiveTest() {
    const pubs = await this.trdizin.getInstitutionPublications(undefined, { limit: 5 });
    return {
      itemsReturned: pubs.length,
      firstItem: pubs[0] ? {
        id: pubs[0].id,
        title: pubs[0].title,
        year: pubs[0].year,
        journal: pubs[0].journal?.name,
        doi: pubs[0].doi,
        authors: pubs[0].authors.slice(0, 3).map(a => a.name),
        citedBy: pubs[0].citedBy,
        isOpenAccess: pubs[0].isOpenAccess,
      } : null,
    };
  }

  // Public diagnostic — SCImago'nun yüklenip yüklenmediğini ve yüklenmediyse
  // hangi hatayla karşılaştığını tarayıcıdan direkt gör.
  @Get('scimago/diagnostic')
  scimagoDiagnostic() {
    return this.scimago.getLastAttemptReport();
  }

  // Public diagnostic — OpenAIRE'a son yapılan sorgu ve ham cevap örneği
  @Get('cordis/diagnostic')
  cordisDiagnostic() {
    return this.cordis.getDiagnostic();
  }

  // Public live-test — anında bir Türkiye sorgusu atar ve sonucu döner
  @Get('cordis/test')
  async cordisLiveTest() {
    const projects = await this.cordis.searchProjectsByCountry('TR', 5);
    return {
      requestedCountry: 'TR',
      itemsReturned: projects.length,
      firstItem: projects[0] || null,
      diagnostic: this.cordis.getDiagnostic(),
    };
  }

  @Get('status')
  getStatus() {
    return {
      crossref:        { configured: this.crossref.isConfigured(), requiresKey: false, note: 'CROSSREF_MAILTO email için önerilir (polite pool)' },
      scimago:         { configured: true,                        requiresKey: false, journalCount: this.scimago.getSize(), note: this.scimago.getSize() > 0 ? `SCImago tablosu yüklü (${this.scimago.getSize()} dergi)` : 'SCImago CSV yok — OpenAlex venue fallback devrede (250k+ dergi)' },
      openAccess:      { configured: this.oa.isConfigured(),       requiresKey: false, note: 'Unpaywall + DOAJ, UNPAYWALL_MAILTO önerilir' },
      scopus:          { configured: !!process.env.SCOPUS_API_KEY, requiresKey: true,  note: 'SCOPUS_API_KEY' },
      wos:             { configured: this.wos.isConfigured(),      requiresKey: true,  note: 'WOS_API_KEY Clarivate Developer Portal' },
      patent:          { configured: this.patent.isConfigured(),   requiresKey: true,  note: 'EPO OPS (TR patentleri dahil) — EPO_CONSUMER_KEY + EPO_CONSUMER_SECRET' },
      openalex:        { configured: this.openalex.isConfigured(), requiresKey: false, note: 'Ücretsiz, OPENALEX_MAILTO önerilir' },
      dergipark:       { configured: this.dergipark.isConfigured(),requiresKey: false, note: 'Türk akademik dergileri (OAI-PMH)' },
      cordis:          { configured: this.cordis.isConfigured(),   requiresKey: false, note: 'OpenAIRE üzerinden AB projeleri (Horizon Europe / H2020 / FP7 dahil)' },
      pubmed:          { configured: true,                         requiresKey: false, note: 'NCBI E-utilities — PUBMED_MAILTO önerilir' },
      arxiv:           { configured: true,                         requiresKey: false, note: 'STEM preprint' },
      semanticScholar: { configured: true,                         requiresKey: false, note: 'SEMANTIC_SCHOLAR_KEY opsiyonel (yüksek rate için)' },
      trdizin:         { configured: this.trdizin.isConfigured(),  requiresKey: false, note: 'TR Dizin (TÜBİTAK ULAKBİM) — Türkçe akademik yayınlar, MKÜ inst code: ' + (process.env.TRDIZIN_INST_CODE || 'MzU1MDg2') },
    };
  }
}
