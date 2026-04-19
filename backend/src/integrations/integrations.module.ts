import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { CrossrefService } from './crossref.service';
import { ScimagoService } from './scimago.service';
import { OpenAccessService } from './open-access.service';

/**
 * Entegrasyonlar modülü — akademik veri kaynaklarıyla köprü.
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
  controllers: [IntegrationsController],
  providers: [CrossrefService, ScimagoService, OpenAccessService],
  exports: [CrossrefService, ScimagoService, OpenAccessService],
})
export class IntegrationsModule {}
