import { Controller, Get, Post, Query, UseGuards, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CrossrefService } from './crossref.service';
import { ScimagoService } from './scimago.service';
import { OpenAccessService } from './open-access.service';
import { WosService } from './wos.service';

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
  ) {}

  // Her entegrasyonun yapılandırma durumunu tek yerden raporla
  @Get('status')
  getStatus() {
    return {
      crossref:    { configured: this.crossref.isConfigured(), requiresKey: false, note: 'CROSSREF_MAILTO email için önerilir (polite pool)' },
      scimago:     { configured: this.scimago.isConfigured(),  requiresKey: false, journalCount: this.scimago.getSize() },
      openAccess:  { configured: this.oa.isConfigured(),       requiresKey: false, note: 'UNPAYWALL_MAILTO önerilir' },
      scopus:      { configured: !!process.env.SCOPUS_API_KEY, requiresKey: true },
      wos:         { configured: this.wos.isConfigured(),      requiresKey: true, note: 'WOS_API_KEY Clarivate Developer Portal' },
    };
  }

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
}
