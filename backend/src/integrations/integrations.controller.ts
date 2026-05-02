import { Controller, Get, Post, Query, UseGuards, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CrossrefService } from './crossref.service';
import { ScimagoService } from './scimago.service';
import { OpenAccessService } from './open-access.service';
import { WosService } from './wos.service';
import { PatentService } from './patent.service';
import { OpenAlexService } from './openalex.service';
import { DergiparkService } from './dergipark.service';
import { CordisService } from './cordis.service';
import { LiteratureService } from './literature.service';
import { PublicationsService } from './publications.service';

@SkipThrottle()
@ApiTags('integrations')
@Controller('integrations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IntegrationsController {
  constructor(
    private readonly crossref: CrossrefService,
    private readonly scimago: ScimagoService,
    private readonly oa: OpenAccessService,
    private readonly wos: WosService,
    private readonly patent: PatentService,
    private readonly openalex: OpenAlexService,
    private readonly dergipark: DergiparkService,
    private readonly cordis: CordisService,
    private readonly literature: LiteratureService,
    private readonly publications: PublicationsService,
  ) {}

  // NOT: Status endpoint'i ayrı bir controller'da (IntegrationsStatusController) - public.

  // ── SCIMAGO ───────────────────────────────────────────────────────────
  @Get('scimago/issn')
  async scimagoByIssn(@Query('issn') issn: string) {
    if (!issn) throw new BadRequestException('issn parametresi zorunlu');
    const q = await this.scimago.getQualityByIssn(issn);
    if (!q) throw new ServiceUnavailableException('Dergi bulunamadı veya SCImago tablosu henüz yüklenmedi');
    return q;
  }

  @Get('scimago/title')
  async scimagoByTitle(@Query('title') title: string) {
    if (!title) throw new BadRequestException('title parametresi zorunlu');
    const q = await this.scimago.findByTitle(title);
    if (!q) throw new ServiceUnavailableException('Dergi bulunamadı');
    return q;
  }

  @Post('scimago/refresh')
  async scimagoRefresh() {
    return this.scimago.refresh();
  }

  /**
   * Bibliyometri verilerini bastan hesaplamak icin TUM bibliyometri cache'lerini sifirlar.
   *
   * Hangi cache'ler temizlenir:
   *  - SCImago tablosu (CSV reload + venue lookup cache)
   *  - OpenAlex cache (institution summary, aggregates, author works)
   *  - Publications cache (ORCID/name/institution sorgulari)
   *
   * KULLANIM SENARYOLARI:
   *  - Yeni SCImago CSV commit edildikten sonra
   *  - Bibliyometri sonuclarinda "Bilinmiyor" coksa sifirlamak icin
   *  - OpenAlex'ten yeni veri cekmek icin (12-24 saatlik cache atilir)
   *
   * Bu islem ilk istegin gec olmasina yol acar (~30-60 sn) - tipik olarak
   * gerekirse 1-2 ayda bir manuel calistirilir.
   */
  @Post('bibliometrics/rebuild-cache')
  async rebuildBibliometricsCache() {
    const scimago = await this.scimago.refresh();
    const openalexCleared = this.openalex.clearCache();
    const publicationsCleared = this.publications.clearCache();
    return {
      ok: true,
      scimago,
      openalexCacheCleared: openalexCleared,
      publicationsCacheCleared: publicationsCleared,
      note: 'Bir sonraki bibliyometri sorgusu temiz cache ile calisacak (~30-60 sn)',
    };
  }

  // ── CROSSREF ──────────────────────────────────────────────────────────
  @Get('crossref/doi')
  async crossrefDoi(@Query('doi') doi: string) {
    if (!doi) throw new BadRequestException('doi parametresi zorunlu');
    const work = await this.crossref.getWorkByDoi(doi);
    if (!work) throw new ServiceUnavailableException('Crossref\'ten yayın bilgisi alınamadı');
    return work;
  }

  @Get('crossref/search')
  async crossrefSearch(
    @Query('title') title: string,
    @Query('author') author?: string,
    @Query('year') year?: string,
  ) {
    if (!title || title.length < 5) throw new BadRequestException('title en az 5 karakter olmalı');
    return this.crossref.searchByTitle(title, author, year ? +year : undefined);
  }

  @Get('crossref/orcid')
  async crossrefOrcid(@Query('orcidId') orcidId: string, @Query('limit') limit?: string) {
    if (!orcidId) throw new BadRequestException('orcidId parametresi zorunlu');
    return this.crossref.getWorksByOrcid(orcidId, limit ? +limit : 100);
  }

  @Get('crossref/events')
  async crossrefEvents(@Query('doi') doi: string) {
    if (!doi) throw new BadRequestException('doi parametresi zorunlu');
    return this.crossref.getCitationEvents(doi);
  }

  // ── OPEN ACCESS ───────────────────────────────────────────────────────
  @Get('oa/unpaywall')
  async oaByDoi(@Query('doi') doi: string) {
    if (!doi) throw new BadRequestException('doi parametresi zorunlu');
    const info = await this.oa.getOaStatusByDoi(doi);
    if (!info) throw new ServiceUnavailableException('Unpaywall bilgisi alınamadı');
    return info;
  }

  @Get('oa/doaj')
  async oaDoaj(@Query('issn') issn: string) {
    if (!issn) throw new BadRequestException('issn parametresi zorunlu');
    const info = await this.oa.getDoajJournal(issn);
    return info || { listed: false };
  }

  // ── WEB OF SCIENCE ────────────────────────────────────────────────────
  @Get('wos/author')
  async wosAuthor(@Query('id') id: string) {
    if (!this.wos.isConfigured()) {
      throw new ServiceUnavailableException('Web of Science yapılandırılmadı (WOS_API_KEY eksik)');
    }
    if (!id) throw new BadRequestException('id parametresi zorunlu (ResearcherID veya ORCID)');
    const profile = await this.wos.getAuthorProfile(id);
    if (!profile) throw new ServiceUnavailableException('WoS\'ta yazar bulunamadı');
    return profile;
  }

  @Get('wos/publications')
  async wosPublications(@Query('id') id: string, @Query('limit') limit?: string) {
    if (!this.wos.isConfigured()) {
      throw new ServiceUnavailableException('Web of Science yapılandırılmadı');
    }
    if (!id) throw new BadRequestException('id parametresi zorunlu');
    return this.wos.getAuthorPublications(id, limit ? +limit : 50);
  }

  @Get('wos/doi')
  async wosByDoi(@Query('doi') doi: string) {
    if (!this.wos.isConfigured()) {
      throw new ServiceUnavailableException('Web of Science yapılandırılmadı');
    }
    if (!doi) throw new BadRequestException('doi parametresi zorunlu');
    const p = await this.wos.getByDoi(doi);
    if (!p) throw new ServiceUnavailableException('WoS\'ta kayıt bulunamadı');
    return p;
  }

  @Get('wos/affiliation')
  async wosAffiliation(@Query('name') name: string, @Query('limit') limit?: string) {
    if (!this.wos.isConfigured()) {
      throw new ServiceUnavailableException('Web of Science yapılandırılmadı');
    }
    if (!name) throw new BadRequestException('name parametresi zorunlu');
    return this.wos.searchByAffiliation(name, limit ? +limit : 100);
  }

  // ── PATENT (EPO OPS - TR patentleri dahil) ────────────────────────────
  @Get('patent/publication')
  async patentPub(@Query('number') num: string) {
    if (!this.patent.isConfigured()) {
      throw new ServiceUnavailableException('Patent servisi yapılandırılmadı (EPO_CONSUMER_KEY eksik)');
    }
    if (!num) throw new BadRequestException('number parametresi zorunlu (örn. TR2022012345)');
    const r = await this.patent.getByPublicationNumber(num);
    if (!r) throw new ServiceUnavailableException('Patent bulunamadı');
    return r;
  }

  @Get('patent/applicant')
  async patentByApplicant(
    @Query('name') name: string,
    @Query('country') country?: string,
    @Query('limit') limit?: string,
  ) {
    if (!this.patent.isConfigured()) {
      throw new ServiceUnavailableException('Patent servisi yapılandırılmadı');
    }
    if (!name) throw new BadRequestException('name parametresi zorunlu');
    return this.patent.searchByApplicant(name, country || 'TR', limit ? +limit : 25);
  }

  @Get('patent/verify')
  async patentVerify(
    @Query('number') number: string,
    @Query('applicant') applicant: string,
  ) {
    if (!this.patent.isConfigured()) {
      throw new ServiceUnavailableException('Patent servisi yapılandırılmadı');
    }
    if (!number || !applicant) {
      throw new BadRequestException('number ve applicant parametreleri zorunlu');
    }
    return this.patent.verifyOwnership(number, applicant);
  }

  // ── OPENALEX (Ücretsiz, Scopus/WoS'un açık alternatifi) ───────────────
  @Get('openalex/author/orcid')
  async oaAuthorByOrcid(@Query('orcidId') orcidId: string) {
    if (!orcidId) throw new BadRequestException('orcidId parametresi zorunlu');
    const a = await this.openalex.getAuthorByOrcid(orcidId);
    if (!a) throw new ServiceUnavailableException('OpenAlex\'te yazar bulunamadı');
    return a;
  }

  @Get('openalex/author/search')
  async oaAuthorSearch(
    @Query('name') name: string,
    @Query('affiliation') affiliation?: string,
    @Query('limit') limit?: string,
  ) {
    if (!name) throw new BadRequestException('name parametresi zorunlu');
    return this.openalex.searchAuthorByName(name, affiliation, limit ? +limit : 10);
  }

  @Get('openalex/author/works')
  async oaAuthorWorks(@Query('authorId') authorId: string, @Query('limit') limit?: string) {
    if (!authorId) throw new BadRequestException('authorId parametresi zorunlu');
    return this.openalex.getAuthorWorks(authorId, limit ? +limit : 100);
  }

  @Get('openalex/institution/search')
  async oaInstitutionSearch(@Query('name') name: string, @Query('country') country?: string) {
    if (!name) throw new BadRequestException('name parametresi zorunlu');
    return this.openalex.searchInstitution(name, country || 'TR');
  }

  @Get('openalex/institution/works')
  async oaInstitutionWorks(
    @Query('institutionId') institutionId: string,
    @Query('year') year?: string,
    @Query('limit') limit?: string,
  ) {
    if (!institutionId) throw new BadRequestException('institutionId parametresi zorunlu');
    return this.openalex.getInstitutionWorks(institutionId, year ? +year : undefined, limit ? +limit : 25);
  }

  @Get('openalex/work/doi')
  async oaWorkByDoi(@Query('doi') doi: string) {
    if (!doi) throw new BadRequestException('doi parametresi zorunlu');
    const w = await this.openalex.getWorkByDoi(doi);
    if (!w) throw new ServiceUnavailableException('OpenAlex\'te yayın bulunamadı');
    return w;
  }

  // ── DERGIPARK (Türk akademik dergileri) ───────────────────────────────
  @Get('dergipark/author')
  async dpAuthor(@Query('name') name: string, @Query('limit') limit?: string) {
    if (!name) throw new BadRequestException('name parametresi zorunlu');
    return this.dergipark.searchByAuthor(name, limit ? +limit : 20);
  }

  @Get('dergipark/journal')
  async dpJournal(@Query('setSpec') setSpec: string, @Query('from') from?: string) {
    if (!setSpec) throw new BadRequestException('setSpec parametresi zorunlu (örn. journal:mkuh)');
    return this.dergipark.harvestJournal(setSpec, from);
  }

  // ── CORDIS (AB araştırma projeleri / Horizon Europe) ──────────────────
  @Get('cordis/country')
  async cordisCountry(@Query('country') country?: string, @Query('limit') limit?: string) {
    return this.cordis.searchProjectsByCountry(country || 'TR', limit ? +limit : 50);
  }

  @Get('cordis/organization')
  async cordisOrg(@Query('name') name: string, @Query('limit') limit?: string) {
    if (!name) throw new BadRequestException('name parametresi zorunlu');
    return this.cordis.searchProjectsByOrganization(name, limit ? +limit : 25);
  }

  @Get('cordis/search')
  async cordisSearch(@Query('q') q: string, @Query('limit') limit?: string) {
    if (!q) throw new BadRequestException('q parametresi zorunlu');
    return this.cordis.searchProjects(q, limit ? +limit : 25);
  }

  // ── PUBMED ────────────────────────────────────────────────────────────
  @Get('pubmed/search')
  async pmSearch(@Query('q') q: string, @Query('limit') limit?: string) {
    if (!q) throw new BadRequestException('q parametresi zorunlu');
    return this.literature.searchPubmed(q, limit ? +limit : 20);
  }

  @Get('pubmed/doi')
  async pmByDoi(@Query('doi') doi: string) {
    if (!doi) throw new BadRequestException('doi parametresi zorunlu');
    const r = await this.literature.getPubmedByDoi(doi);
    return r || { notFound: true };
  }

  // ── ARXIV ─────────────────────────────────────────────────────────────
  @Get('arxiv/search')
  async arxivSearch(@Query('q') q: string, @Query('limit') limit?: string) {
    if (!q) throw new BadRequestException('q parametresi zorunlu');
    return this.literature.searchArxiv(q, limit ? +limit : 20);
  }

  // ── SEMANTIC SCHOLAR ──────────────────────────────────────────────────
  @Get('s2/paper')
  async s2Paper(@Query('id') id: string) {
    if (!id) throw new BadRequestException('id (paperId veya DOI) zorunlu');
    const r = await this.literature.getS2Paper(id);
    if (!r) throw new ServiceUnavailableException('Semantic Scholar\'da bulunamadı');
    return r;
  }

  @Get('s2/citations')
  async s2Cit(@Query('paperId') paperId: string, @Query('limit') limit?: string) {
    if (!paperId) throw new BadRequestException('paperId parametresi zorunlu');
    return this.literature.getS2Citations(paperId, limit ? +limit : 50);
  }

  @Get('s2/author')
  async s2Author(@Query('id') id: string) {
    if (!id) throw new BadRequestException('id parametresi zorunlu');
    const r = await this.literature.getS2AuthorProfile(id);
    if (!r) throw new ServiceUnavailableException('Yazar bulunamadı');
    return r;
  }

  // ── UNIFIED SEARCH ────────────────────────────────────────────────────
  @Get('literature/search')
  async literatureSearch(@Query('q') q: string, @Query('limit') limit?: string) {
    if (!q) throw new BadRequestException('q parametresi zorunlu');
    return this.literature.searchAll(q, limit ? +limit : 10);
  }

  // ── UNIFIED PUBLICATIONS (dedupe + enrichment) ────────────────────────
  @Get('publications/orcid')
  async pubsByOrcid(@Query('orcidId') orcidId: string, @Query('limit') limit?: string) {
    if (!orcidId) throw new BadRequestException('orcidId parametresi zorunlu');
    const pubs = await this.publications.getAuthorPublicationsByOrcid(orcidId, limit ? +limit : 100);
    return { items: pubs, summary: this.publications.summarize(pubs) };
  }

  @Get('publications/doi')
  async pubsByDoi(@Query('doi') doi: string) {
    if (!doi) throw new BadRequestException('doi parametresi zorunlu');
    const p = await this.publications.getUnifiedByDoi(doi);
    if (!p) throw new ServiceUnavailableException('Yayın hiçbir kaynakta bulunamadı');
    return p;
  }

  @Get('publications/institution')
  async pubsByInstitution(
    @Query('institutionId') institutionId: string,
    @Query('year') year?: string,
    @Query('limit') limit?: string,
  ) {
    if (!institutionId) throw new BadRequestException('institutionId parametresi zorunlu');
    const pubs = await this.publications.getInstitutionPublications(institutionId, year ? +year : undefined, limit ? +limit : 200);
    return { items: pubs, summary: this.publications.summarize(pubs) };
  }
}
