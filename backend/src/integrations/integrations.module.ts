import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsStatusController } from './integrations-status.controller';
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
import { TrDizinService } from './trdizin.service';
import { GoogleScholarService } from './google-scholar.service';

/**
 * Entegrasyonlar modülü - akademik veri kaynaklarıyla köprü.
 *
 * Şu an aktif:
 *  - Crossref (ücretsiz, DOI metadata + atıf olayları)
 *
 * Roadmap:
 *  - SCImago SJR (dergi quartile)
 *  - DOAJ + Unpaywall (open access tespiti)
 *  - Web of Science (env-gated, kurumsal API key)
 *  - TÜRKPATENT (public patent search)
 *  - TÜBİTAK Arbis (public researcher search)
 *  - DergiPark (OAI-PMH Türk dergileri)
 *  - CORDIS (AB açık çağrı feed)
 *  - PubMed / arXiv / Semantic Scholar
 */
@Module({
  controllers: [IntegrationsController, IntegrationsStatusController],
  providers: [
    CrossrefService, ScimagoService, OpenAccessService, WosService, PatentService,
    OpenAlexService, DergiparkService, CordisService, LiteratureService,
    PublicationsService, TrDizinService, GoogleScholarService,
  ],
  exports: [
    CrossrefService, ScimagoService, OpenAccessService, WosService, PatentService,
    OpenAlexService, DergiparkService, CordisService, LiteratureService,
    PublicationsService, TrDizinService, GoogleScholarService,
  ],
})
export class IntegrationsModule {}
