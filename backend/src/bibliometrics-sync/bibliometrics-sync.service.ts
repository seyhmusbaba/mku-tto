import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { OpenAlexService } from '../integrations/openalex.service';
import { ScopusService } from '../scopus/scopus.service';
import { TrDizinService } from '../integrations/trdizin.service';
import { WosService } from '../integrations/wos.service';
import { GoogleScholarService } from '../integrations/google-scholar.service';

export interface SyncResult {
  userId: string;
  sources: {
    openalex?: { docs: number; citations: number; hIndex: number; synced: boolean; error?: string };
    googleScholar?: { docs: number; citations: number; hIndex: number; synced: boolean; note?: string; error?: string };
    scopus?: { docs: number; citations: number; hIndex: number; synced: boolean; error?: string };
    wos?: { docs: number; citations: number; hIndex: number; synced: boolean; error?: string; note?: string };
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
    private wos: WosService,
    private scholar: GoogleScholarService,
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
    const [oaResult, scopusResult, trResult, wosResult, scholarResult] = await Promise.all([
      this.syncOpenAlex(user).catch(e => ({ error: e.message })),
      this.syncScopus(user).catch(e => ({ error: e.message })),
      this.syncTrDizin(user).catch(e => ({ error: e.message })),
      this.syncWos(user).catch(e => ({ error: e.message })),
      this.syncScholar(user).catch(e => ({ error: e.message })),
    ]);

    // ── OpenAlex (ORCID) ─────────────────────────────────────
    if ('docs' in oaResult) {
      result.sources.openalex = { ...oaResult, synced: true };
      (user as any).openAlexDocCount = oaResult.docs;
      (user as any).openAlexCitedBy = oaResult.citations;
      (user as any).openAlexHIndex = oaResult.hIndex;
      (user as any).openAlexLastSync = new Date().toISOString();
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

    // ── Google Scholar (scraping) ─────────────────────────
    if ('docs' in scholarResult) {
      result.sources.googleScholar = { ...scholarResult, synced: true };
      (user as any).googleScholarDocCount = scholarResult.docs;
      (user as any).googleScholarCitedBy = scholarResult.citations;
      (user as any).googleScholarHIndex = scholarResult.hIndex;
    } else {
      result.sources.googleScholar = {
        docs: 0, citations: 0, hIndex: 0, synced: false,
        note: (scholarResult as any).error || 'Scholar verisi alınamadı',
      };
    }

    // ── Web of Science ─────────────────────────────────────
    if ('docs' in wosResult) {
      result.sources.wos = { ...wosResult, synced: true };
      (user as any).wosDocCount = wosResult.docs;
      (user as any).wosCitedBy = wosResult.citations;
      (user as any).wosHIndex = wosResult.hIndex;
      user.wosLastSync = new Date().toISOString();
    } else {
      result.sources.wos = {
        docs: 0, citations: 0, hIndex: 0, synced: false,
        error: (wosResult as any).error,
      };
    }

    // ── Dedupe edilmiş toplam yayın — OpenAlex baz alınır (en geniş kapsam)
    const estimatedTotal = Math.max(
      result.sources.openalex?.docs || 0,
      result.sources.scopus?.docs || 0,
      result.sources.wos?.docs || 0,
      result.sources.trDizin?.docs || 0,
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
    let author: any = null;

    // 1. Önce openAlexAuthorId varsa onu kullan (manuel override — en güvenilir)
    if ((user as any).openAlexAuthorId) {
      const id = (user as any).openAlexAuthorId.trim();
      if (!/^A\d{4,}$/i.test(id)) {
        throw new Error('Geçersiz OpenAlex Author ID — A5012345678 formatında olmalı');
      }
      // Works endpoint'inden works çekip author meta'yı ilk work'ten alırız (veya direkt author API)
      const authorsApi = `https://api.openalex.org/authors/${id}`;
      try {
        const res = await fetch(authorsApi, { headers: { 'User-Agent': 'mku-tto/1.0' }, signal: AbortSignal.timeout(15000) });
        if (res.ok) {
          const data = await res.json();
          author = {
            id: data.id,
            hIndex: data.summary_stats?.h_index,
            worksCount: data.works_count,
            citedByCount: data.cited_by_count,
          };
        } else {
          throw new Error(`OpenAlex author ID bulunamadı: ${id}`);
        }
      } catch (e: any) {
        throw new Error(`OpenAlex ID ile erişilemedi: ${e.message}`);
      }
    }

    // 2. ORCID ile dene
    if (!author && user.orcidId) {
      author = await this.openAlex.getAuthorByOrcid(user.orcidId);
      if (!author) {
        throw new Error(`OpenAlex'te ORCID "${user.orcidId}" ile yazar bulunamadı`);
      }
    }

    if (!author) {
      throw new Error('OpenAlex için ne ORCID ne de OpenAlex ID tanımlı değil');
    }

    // 3. Yazar meta zaten author nesnesinde; atıf yoksa works'ten hesapla
    let docs = author.worksCount || 0;
    let citations = author.citedByCount || 0;
    let hIndex = author.hIndex || 0;

    if (!citations || !hIndex) {
      const works = await this.openAlex.getAuthorWorks(author.id, 200);
      if (!citations) citations = works.reduce((sum: number, w: any) => sum + (w.citedBy || 0), 0);
      if (!hIndex) hIndex = this.computeHIndex(works.map((w: any) => w.citedBy || 0));
      if (!docs) docs = works.length;
    }

    return { docs, citations, hIndex };
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

  // ═════════ Web of Science ═════════
  private async syncWos(user: User): Promise<{ docs: number; citations: number; hIndex: number }> {
    if (!this.wos.isConfigured()) {
      throw new Error('WOS_API_KEY env tanımlı değil (Railway Variables → WOS_API_KEY ekleyin)');
    }

    // Önce WoS Researcher ID, yoksa ORCID ile dene
    const identifier = user.wosResearcherId || user.orcidId;
    if (!identifier) {
      throw new Error('WoS ResearcherID veya ORCID tanımlı değil');
    }

    this.logger.log(`[WoS] Yazar aranıyor: ${identifier} (${user.wosResearcherId ? 'ResearcherID' : 'ORCID'})`);
    const profile = await this.wos.getAuthorProfile(identifier);

    if (!profile) {
      throw new Error(`WoS'ta "${identifier}" ile yazar bulunamadı — API key veya ID'yi kontrol edin`);
    }

    this.logger.log(`[WoS] ${identifier}: ${profile.documentCount} yayın, ${profile.citedByCount} atıf, h=${profile.hIndex}`);

    return {
      docs: profile.documentCount || 0,
      citations: profile.citedByCount || 0,
      hIndex: profile.hIndex || 0,
    };
  }

  // ═════════ Google Scholar (scraping) ═════════
  private async syncScholar(user: User): Promise<{ docs: number; citations: number; hIndex: number }> {
    if (!user.googleScholarId) {
      throw new Error('Google Scholar ID tanımlı değil');
    }

    const metrics = await this.scholar.getAuthorMetrics(user.googleScholarId);
    if (!metrics) {
      throw new Error('Scholar verisine ulaşılamadı (CAPTCHA, rate limit veya geçersiz ID)');
    }

    return {
      docs: metrics.docCount,
      citations: metrics.citations,
      hIndex: metrics.hIndex,
    };
  }

  // ═════════ TR Dizin ═════════
  private async syncTrDizin(user: User): Promise<{ docs: number; citations: number; hIndex: number }> {
    const fullName = `${user.firstName} ${user.lastName}`.trim();
    if (fullName.length < 5) {
      throw new Error('İsim/soyisim çok kısa (en az 5 karakter)');
    }

    // Önce kurum hint'siz ara — isim yeterince özgünse doğru sonuçlar
    let pubs = await this.trDizin.searchByAuthorName(fullName, undefined, 100).catch(() => []);
    this.logger.log(`[TR Dizin] "${fullName}" için ${pubs.length} yayın bulundu (hint'siz)`);

    // Çok fazla sonuç varsa "Mustafa Kemal" hint'i ile daralt
    if (pubs.length > 200) {
      const filtered = await this.trDizin.searchByAuthorName(fullName, 'Mustafa Kemal', 100).catch(() => []);
      if (filtered.length > 0) pubs = filtered;
      this.logger.log(`[TR Dizin] "Mustafa Kemal" hint'i ile ${filtered.length} yayına daraltıldı`);
    }

    if (pubs.length === 0) {
      throw new Error(`TR Dizin'de "${fullName}" adına yayın bulunamadı`);
    }

    let citations = 0;
    const citationList: number[] = [];
    for (const p of pubs) {
      const c = (p as any).citedBy || (p as any).citationCount || 0;
      citations += c;
      citationList.push(c);
    }
    const hIndex = this.computeHIndex(citationList);

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
