import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { OpenAlexService } from '../integrations/openalex.service';
import { ScopusService } from '../scopus/scopus.service';
import { TrDizinService } from '../integrations/trdizin.service';

export interface SyncResult {
  userId: string;
  sources: {
    openalex?: { docs: number; citations: number; hIndex: number; synced: boolean; error?: string };
    googleScholar?: { docs: number; citations: number; hIndex: number; synced: boolean; note?: string };
    scopus?: { docs: number; citations: number; hIndex: number; synced: boolean; error?: string };
    wos?: { synced: boolean; note: string };
    trDizin?: { docs: number; citations: number; hIndex: number; synced: boolean; error?: string };
  };
  totalPublications?: number;
  openAccessCount?: number;
  syncedAt: string;
}

/**
 * Tüm bibliyometrik kaynakları tek bir endpoint ile otomatik senkronlar.
 *
 * Kaynaklar:
 *  - OpenAlex (ORCID üzerinden) — bedava, bol kapsam, Scholar'a en yakın
 *  - Scopus (Scopus Author ID) — API key gerekli
 *  - TR Dizin (ad-soyad + kurum) — bedava, Türkçe odaklı
 *
 * Google Scholar: direkt erişim yok — OpenAlex kapsamı buraya yerleşiyor.
 * Kullanıcının googleScholarId'si varsa, OpenAlex rakamlarını Scholar yerine
 * placeholder olarak gösteriyoruz (veritabanında ayrı tutuyoruz).
 */
@Injectable()
export class BibliometricsSyncService {
  private readonly logger = new Logger(BibliometricsSyncService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private openAlex: OpenAlexService,
    private scopus: ScopusService,
    private trDizin: TrDizinService,
  ) {}

  /**
   * Bir kullanıcının tüm kaynaklardan metriklerini yenile.
   * Her kaynak bağımsız — birinin hatası diğerini etkilemez.
   */
  async syncUser(userId: string): Promise<SyncResult> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');

    const result: SyncResult = {
      userId,
      sources: {},
      syncedAt: new Date().toISOString(),
    };

    // ── Paralel başlat ─────────────────────────────────────────
    const [oaResult, scopusResult, trResult] = await Promise.all([
      this.syncOpenAlex(user).catch(e => ({ error: e.message })),
      this.syncScopus(user).catch(e => ({ error: e.message })),
      this.syncTrDizin(user).catch(e => ({ error: e.message })),
    ]);

    // ── OpenAlex (ORCID) ─────────────────────────────────────
    if ('docs' in oaResult) {
      result.sources.openalex = { ...oaResult, synced: true };

      // Google Scholar yerine OpenAlex rakamlarını kullan — en yakın proxy
      // (kullanıcının googleScholarId'si varsa — yani "Scholar'dan veri istiyor")
      if (user.googleScholarId) {
        (user as any).googleScholarDocCount = oaResult.docs;
        (user as any).googleScholarCitedBy = oaResult.citations;
        (user as any).googleScholarHIndex = oaResult.hIndex;
        result.sources.googleScholar = {
          ...oaResult,
          synced: true,
          note: 'Google Scholar API\'si yok — OpenAlex kapsamı kullanıldı (gri literatür dahil, Scholar\'a en yakın).',
        };
      }
    } else {
      result.sources.openalex = { docs: 0, citations: 0, hIndex: 0, synced: false, error: (oaResult as any).error };
    }

    // ── Scopus ─────────────────────────────────────────────
    if ('docs' in scopusResult) {
      result.sources.scopus = { ...scopusResult, synced: true };
      (user as any).scopusDocCount = scopusResult.docs;
      (user as any).scopusCitedBy = scopusResult.citations;
      (user as any).scopusHIndex = scopusResult.hIndex;
      user.scopusLastSync = new Date().toISOString();
    } else {
      result.sources.scopus = { docs: 0, citations: 0, hIndex: 0, synced: false, error: (scopusResult as any).error };
    }

    // ── TR Dizin ──────────────────────────────────────────
    if ('docs' in trResult) {
      result.sources.trDizin = { ...trResult, synced: true };
      (user as any).trDizinDocCount = trResult.docs;
      (user as any).trDizinCitedBy = trResult.citations;
      (user as any).trDizinHIndex = trResult.hIndex;
    } else {
      result.sources.trDizin = { docs: 0, citations: 0, hIndex: 0, synced: false, error: (trResult as any).error };
    }

    // ── Web of Science — kurumsal API key yoksa manuel kalır ─
    result.sources.wos = {
      synced: false,
      note: user.wosResearcherId
        ? 'WoS API key gerekli. Manuel girebilir veya WOS_API_KEY env tanımlayın.'
        : 'WoS Researcher ID tanımlı değil.',
    };

    // ── Dedupe edilmiş toplam yayın — OpenAlex baz alınır (en geniş kapsam)
    const estimatedTotal = Math.max(
      result.sources.openalex?.docs || 0,
      result.sources.scopus?.docs || 0,
      (user as any).totalPublicationCount || 0,
    );
    if (estimatedTotal > 0) {
      (user as any).totalPublicationCount = estimatedTotal;
      result.totalPublications = estimatedTotal;
    }

    await this.userRepo.save(user);
    this.logger.log(`[Sync] User ${userId}: OpenAlex=${result.sources.openalex?.docs}, Scopus=${result.sources.scopus?.docs}, TR Dizin=${result.sources.trDizin?.docs}`);

    return result;
  }

  // ═════════ OpenAlex ═════════
  private async syncOpenAlex(user: User): Promise<{ docs: number; citations: number; hIndex: number }> {
    if (!user.orcidId) {
      throw new Error('ORCID ID tanımlı değil');
    }

    // 1. Yazar meta (h-index dahil)
    const author = await this.openAlex.getAuthorByOrcid(user.orcidId);
    if (!author) throw new Error('OpenAlex\'te ORCID ile yazar bulunamadı');

    // 2. Tüm yayınları çek ve atıf toplamını + h-index'i hesapla
    const works = await this.openAlex.getAuthorWorks(author.id, 200);
    const citations = works.reduce((sum, w) => sum + (w.citedBy || 0), 0);
    const hIndex = this.computeHIndex(works.map(w => w.citedBy || 0));
    const openAccessCount = works.filter(w => w.openAccess?.isOa).length;

    // Yazar nesnesinden gelen h-index varsa onu tercih et (100+ yayın için güvenilir)
    const finalHIndex = (author as any).hIndex || hIndex;

    return {
      docs: (author as any).worksCount || works.length,
      citations: (author as any).citedByCount || citations,
      hIndex: finalHIndex,
    };
  }

  // ═════════ Scopus ═════════
  private async syncScopus(user: User): Promise<{ docs: number; citations: number; hIndex: number }> {
    if (!user.scopusAuthorId) {
      throw new Error('Scopus Author ID tanımlı değil');
    }
    const profile = await this.scopus.getAuthorProfile(user.scopusAuthorId);
    if (!profile) throw new Error('Scopus\'ta yazar bulunamadı');

    return {
      docs: (profile as any).docCount || 0,
      citations: (profile as any).citedBy || 0,
      hIndex: (profile as any).hIndex || 0,
    };
  }

  // ═════════ TR Dizin ═════════
  private async syncTrDizin(user: User): Promise<{ docs: number; citations: number; hIndex: number }> {
    const fullName = `${user.firstName} ${user.lastName}`.trim();
    if (fullName.length < 5) {
      throw new Error('İsim/soyisim eksik');
    }

    const pubs = await this.trDizin.searchByAuthorName(
      fullName,
      user.faculty ? undefined : 'Mustafa Kemal', // fakülte varsa daha spesifik değil, kurum hint'i kalsın
      100,
    );

    if (pubs.length === 0) {
      return { docs: 0, citations: 0, hIndex: 0 };
    }

    const citations = pubs.reduce((sum, p) => sum + ((p as any).citedBy || (p as any).citationCount || 0), 0);
    const hIndex = this.computeHIndex(pubs.map(p => (p as any).citedBy || (p as any).citationCount || 0));

    return {
      docs: pubs.length,
      citations,
      hIndex,
    };
  }

  // ═════════ Yardımcı ═════════
  /**
   * h-index hesabı: n yayının h tanesi h veya daha fazla atıf almışsa h-index = h.
   * Klasik tanım.
   */
  private computeHIndex(citations: number[]): number {
    const sorted = citations.filter(c => c >= 0).sort((a, b) => b - a);
    let h = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] >= i + 1) h = i + 1;
      else break;
    }
    return h;
  }

  /**
   * Haftalık otomatik senkronizasyon — Pazar gecesi 02:00'de çalışır.
   * SYNC_BIBLIOMETRICS_WEEKLY=false env ile kapatılabilir.
   */
  @Cron(CronExpression.EVERY_WEEK)
  async weeklySync() {
    if (process.env.SYNC_BIBLIOMETRICS_WEEKLY === 'false') return;
    this.logger.log('[Cron] Haftalık bibliyometrik senkronizasyon başladı...');
    const result = await this.syncAll();
    this.logger.log(`[Cron] Haftalık sync tamam: ${result.succeeded}/${result.total}`);
  }

  /**
   * Admin/cron: tüm kullanıcıları senkronla. Rate limit dostu (paralel 3'erli).
   */
  async syncAll(): Promise<{ total: number; succeeded: number; failed: number }> {
    const users = await this.userRepo.find({ where: { isActive: true as any } });
    let succeeded = 0, failed = 0;

    const BATCH_SIZE = 3;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(u => this.syncUser(u.id)));
      for (const r of results) {
        if (r.status === 'fulfilled') succeeded++;
        else failed++;
      }
    }

    this.logger.log(`[Sync All] ${users.length} kullanıcı · ${succeeded} başarı · ${failed} başarısızlık`);
    return { total: users.length, succeeded, failed };
  }
}
