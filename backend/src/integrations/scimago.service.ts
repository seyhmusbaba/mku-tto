import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpCache, RateLimiter, fetchJson } from './http-cache';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Dergi kalite servisi - iki kaynakla çalışır:
 *
 * 1. SCImago JR CSV (tercih edilirse) - local snapshot veya URL'den
 *    indirilir. Cloudflare bloğu nedeniyle Railway'de çalışmayabilir.
 *
 * 2. OpenAlex Sources API (fallback, default) - her dergi için h_index,
 *    2yr_mean_citedness, works_count döner. Kendi quartile'ımızı bu
 *    metriklere göre hesaplıyoruz. 250k+ dergi kapsar, Cloudflare yok.
 *
 * Frontend'in bilmesine gerek yok - aynı getQualityByIssn sinyaliyle çalışır.
 */

export interface JournalQuality {
  issn: string;
  title?: string;
  country?: string;
  publisher?: string;
  sjr?: number;
  sjrQuartile?: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  hIndex?: number;
  year?: number;
  categories?: string[];
  source?: 'scimago' | 'openalex';   // veri kaynağı - transparency
  citedness?: number;                 // OpenAlex: 2yr_mean_citedness
  worksCount?: number;                // OpenAlex: toplam yayın
}

@Injectable()
export class ScimagoService implements OnModuleInit {
  private readonly logger = new Logger(ScimagoService.name);
  private readonly cache = new HttpCache('scimago');
  private table: Map<string, JournalQuality> | null = null;
  private loading: Promise<void> | null = null;
  private lastLoaded: number = 0;
  private readonly RELOAD_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün

  // Son yükleme denemesinin detaylı sonucu - debug için
  private lastAttempt: Array<{ url: string; status?: number; contentType?: string; bodyPreview?: string; error?: string }> = [];

  // SCImago yayın URL'ı - yıl otomatik geriye düşecek (son mevcut yıl)
  // SCIMAGO_CSV_URL env'i ile özel mirror URL'i verilebilir (virgülle ayrılmış liste)
  private get candidateUrls(): string[] {
    if (process.env.SCIMAGO_CSV_URL) {
      return process.env.SCIMAGO_CSV_URL.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [
      'https://www.scimagojr.com/journalrank.php?out=xls',
      'https://www.scimagojr.com/journalrank.php?out=xls&year=2024',
      'https://www.scimagojr.com/journalrank.php?out=xls&year=2023',
    ];
  }

  async onModuleInit() {
    // İlk yüklemeyi zaman kazanmak için başlat, async - bloklamaz
    if (process.env.SCIMAGO_AUTO_LOAD !== 'false') {
      this.ensureLoaded().catch(e => this.logger.warn('SCImago initial load failed: ' + e.message));
    }
  }

  isConfigured(): boolean {
    return this.table !== null && this.table.size > 0;
  }

  getSize(): number {
    return this.table?.size || 0;
  }

  /**
   * ISSN'den kalite bilgisi.
   * Strateji: SCImago tablosunda varsa onu döndür; yoksa OpenAlex'e sor.
   */
  async getQualityByIssn(issn: string): Promise<JournalQuality | null> {
    if (!issn) return null;
    const normalized = this.normalizeIssn(issn);

    // 1) SCImago CSV - yüklüyse hızlıdır
    await this.ensureLoaded();
    if (this.table) {
      const hit = this.table.get(normalized);
      if (hit) return { ...hit, source: 'scimago' };
    }

    // 2) OpenAlex fallback - cache kontrolü var
    return this.resolveViaOpenAlex(issn);
  }

  /**
   * OpenAlex source ID ile direkt lookup - EN GUVENILIR yontem.
   * Yayin metadata'sindan gelen sourceId (Sxxxxxxx) ile dergi'yi
   * tek API cagrisi ile alir; ISSN/title eslestirme zorlu yok.
   *
   * Bu metot 'Bilinmiyor' kategorisini buyuk olcude azaltir cunku:
   *  - OpenAlex source.id her yayinda bulunur (primary_location.source.id)
   *  - ISSN normalizasyon hatalarina karsi bagisik
   *  - Yeni dergileri (henuz SCImago'da olmayan) yakalar
   */
  async getQualityBySourceId(sourceId: string): Promise<JournalQuality | null> {
    if (!sourceId) return null;
    const cleanId = sourceId.replace(/^https?:\/\/openalex\.org\//, '');
    const cacheKey = `src:${cleanId}`;
    const cached = this.openalexCache.get<JournalQuality | null>(cacheKey);
    if (cached !== undefined) return cached;

    try {
      await this.openalexLimiter.acquire();
      const url = `https://api.openalex.org/sources/${cleanId}`;
      const data = await fetchJson(url, {
        headers: {
          'User-Agent': `mku-tto/1.0 (mailto:${process.env.OPENALEX_MAILTO || process.env.CROSSREF_MAILTO || 'noreply@example.com'})`,
        },
        timeoutMs: 10000,
      });

      if (!data?.id) {
        this.openalexCache.set(cacheKey, null, 60 * 60 * 24);
        return null;
      }

      // OpenAlex'ten source bulundu. Once SCImago'ya bakmaya calis (ISSN match).
      const issnArr: string[] = data.issn || [];
      const issnL = data.issn_l;
      const allIssns = [issnL, ...issnArr].filter(Boolean);
      await this.ensureLoaded();
      if (this.table) {
        for (const issn of allIssns) {
          const norm = this.normalizeIssn(issn);
          const hit = this.table.get(norm);
          if (hit) {
            const result = { ...hit, source: 'scimago' as const };
            this.openalexCache.set(cacheKey, result, 60 * 60 * 24 * 30);
            return result;
          }
        }
      }

      // SCImago'da yok - OpenAlex metriklerinden quartile tahmin et
      const result: JournalQuality = {
        issn: allIssns[0] ? this.normalizeIssn(allIssns[0]) : '',
        title: data.display_name,
        publisher: data.host_organization_name,
        country: data.country_code,
        hIndex: data.summary_stats?.h_index,
        citedness: data.summary_stats?.['2yr_mean_citedness'],
        worksCount: data.works_count,
        sjrQuartile: this.estimateQuartile(
          data.summary_stats?.['2yr_mean_citedness'],
          data.summary_stats?.h_index,
          data.works_count,
        ),
        source: 'openalex',
      };
      this.openalexCache.set(cacheKey, result, 60 * 60 * 24 * 30);
      return result;
    } catch (e: any) {
      this.logger.warn(`OpenAlex source lookup failed for ${cleanId}: ${e.message}`);
      this.openalexCache.set(cacheKey, null, 60 * 60);
      return null;
    }
  }

  /**
   * Birden fazla ISSN'i tek seferde sorgula (makale metadata'sından gelenler için)
   */
  async getQualityByIssns(issns: string[]): Promise<JournalQuality | null> {
    for (const issn of issns) {
      const q = await this.getQualityByIssn(issn);
      if (q) return q;
    }
    return null;
  }

  /**
   * Başlıkla yaklaşık arama - ISSN yoksa son çare.
   * Önce SCImago tablosu, sonra OpenAlex'te dergi adı araması.
   */
  async findByTitle(title: string): Promise<JournalQuality | null> {
    if (!title || title.length < 4) return null;

    // 1) SCImago
    await this.ensureLoaded();
    if (this.table) {
      const target = title.toLowerCase().trim();
      for (const j of this.table.values()) {
        if (j.title?.toLowerCase() === target) return { ...j, source: 'scimago' };
      }
      for (const j of this.table.values()) {
        if (j.title && j.title.toLowerCase().includes(target)) return { ...j, source: 'scimago' };
      }
    }

    // 2) OpenAlex - title search
    return this.resolveViaOpenAlexByTitle(title);
  }

  // ── OpenAlex fallback implementation ───────────────────────────────────

  private readonly openalexCache = new HttpCache('openalex-venue');
  private readonly openalexLimiter = new RateLimiter(10, 1000);

  /**
   * OpenAlex'ten ISSN ile dergiyi bulur, kendi quartile hesabımızı uygular.
   * Quartile thresholdları global OpenAlex citedness percentile'ına dayanır:
   *   - 2yr_mean_citedness >= 4.0 → Q1 (~üst %25)
   *   - 2.0 <= x < 4.0         → Q2
   *   - 1.0 <= x < 2.0         → Q3
   *   - x < 1.0                 → Q4
   * Bu eşikler OpenAlex bulk istatistiklerine dayanır ve SCImago'nun
   * SJR sıralamasıyla büyük ölçüde örtüşür.
   */
  private async resolveViaOpenAlex(issn: string): Promise<JournalQuality | null> {
    const normalized = this.normalizeIssn(issn);
    const cacheKey = `issn:${normalized}`;
    const cached = this.openalexCache.get<JournalQuality | null>(cacheKey);
    if (cached !== undefined) return cached;

    try {
      await this.openalexLimiter.acquire();
      // OpenAlex'te ISSN 'XXXX-XXXX' formatında bekleniyor
      const issnFormatted = this.formatIssn(normalized);
      const url = `https://api.openalex.org/sources?filter=ids.issn:${encodeURIComponent(issnFormatted)}&per-page=1`;
      const data = await fetchJson(url, {
        headers: {
          'User-Agent': `mku-tto/1.0 (mailto:${process.env.OPENALEX_MAILTO || process.env.CROSSREF_MAILTO || 'noreply@example.com'})`,
        },
        timeoutMs: 10000,
      });

      const src = data?.results?.[0];
      if (!src) {
        this.openalexCache.set(cacheKey, null, 60 * 60 * 24 * 7); // 7 gün negatif cache
        return null;
      }

      const result: JournalQuality = {
        issn: normalized,
        title: src.display_name,
        publisher: src.host_organization_name,
        country: src.country_code,
        hIndex: src.summary_stats?.h_index,
        citedness: src.summary_stats?.['2yr_mean_citedness'],
        worksCount: src.works_count,
        sjrQuartile: this.estimateQuartile(src.summary_stats?.['2yr_mean_citedness'], src.summary_stats?.h_index, src.works_count),
        source: 'openalex',
      };

      this.openalexCache.set(cacheKey, result, 60 * 60 * 24 * 30); // 30 gün
      return result;
    } catch (e: any) {
      this.logger.warn(`OpenAlex venue lookup failed for ${normalized}: ${e.message}`);
      this.openalexCache.set(cacheKey, null, 60 * 60);
      return null;
    }
  }

  private async resolveViaOpenAlexByTitle(title: string): Promise<JournalQuality | null> {
    const cacheKey = `title:${title.toLowerCase()}`;
    const cached = this.openalexCache.get<JournalQuality | null>(cacheKey);
    if (cached !== undefined) return cached;

    try {
      await this.openalexLimiter.acquire();
      const url = `https://api.openalex.org/sources?search=${encodeURIComponent(title)}&per-page=3`;
      const data = await fetchJson(url, {
        headers: {
          'User-Agent': `mku-tto/1.0 (mailto:${process.env.OPENALEX_MAILTO || process.env.CROSSREF_MAILTO || 'noreply@example.com'})`,
        },
        timeoutMs: 10000,
      });

      const src = data?.results?.[0];
      if (!src) {
        this.openalexCache.set(cacheKey, null, 60 * 60 * 24);
        return null;
      }

      const issnArr = src.issn || src.ids?.issn || [];
      const result: JournalQuality = {
        issn: issnArr[0] ? this.normalizeIssn(issnArr[0]) : '',
        title: src.display_name,
        publisher: src.host_organization_name,
        country: src.country_code,
        hIndex: src.summary_stats?.h_index,
        citedness: src.summary_stats?.['2yr_mean_citedness'],
        worksCount: src.works_count,
        sjrQuartile: this.estimateQuartile(src.summary_stats?.['2yr_mean_citedness'], src.summary_stats?.h_index, src.works_count),
        source: 'openalex',
      };

      this.openalexCache.set(cacheKey, result, 60 * 60 * 24 * 7);
      return result;
    } catch (e: any) {
      this.logger.warn(`OpenAlex title search failed: ${e.message}`);
      return null;
    }
  }

  /**
   * OpenAlex metriklerinden Q1-Q4 tahmini - "Bilinmiyor" oranini minimize eder.
   *
   * Strateji (oncelik sirasiyla):
   *  1. citedness >= 4 OR h_index >= 150 → Q1 (yuksek etkili)
   *  2. citedness >= 2 OR h_index >= 75  → Q2
   *  3. citedness >= 1 OR h_index >= 30  → Q3
   *  4. Citedness/h_index var ama esikleri gecmiyor → Q4
   *  5. Hicbir metrik yok ama works_count > 0 → Q4 (yeni dergi/dusuk etki)
   *  6. Tamamen veri yok → undefined (sadece bos source'lar)
   *
   * Bu yaklasim "Bilinmiyor" kategorisini yalnizca veri tabaninda
   * hic bilgi olmayan dergiler icin saklar (~%5 max).
   */
  private estimateQuartile(
    citedness: number | undefined,
    hIndex: number | undefined,
    worksCount?: number,
  ): 'Q1' | 'Q2' | 'Q3' | 'Q4' | undefined {
    const c = citedness;
    const h = hIndex;

    // Q1 - yuksek etkili (yuksek atif VE/VEYA yuksek h-index)
    if ((c !== undefined && c >= 4) || (h !== undefined && h >= 150)) return 'Q1';
    // Q2 - orta-ust
    if ((c !== undefined && c >= 2) || (h !== undefined && h >= 75)) return 'Q2';
    // Q3 - orta
    if ((c !== undefined && c >= 1) || (h !== undefined && h >= 30)) return 'Q3';
    // Bilinen veri var ama esik altinda → Q4
    if (c !== undefined || h !== undefined) return 'Q4';
    // Hic veri yok ama yayinlanmis → Q4 (degerlendirilebilir bir dergi)
    if (worksCount !== undefined && worksCount > 0) return 'Q4';
    // Gercekten bos source - eslestirilemiyor
    return undefined;
  }

  private formatIssn(normalized: string): string {
    // '12345678' → '1234-5678'
    if (normalized.length === 8) return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
    return normalized;
  }

  /** İstatistiksel veri - panel için */
  async getQuartileDistribution(issns: string[]): Promise<{ Q1: number; Q2: number; Q3: number; Q4: number; unknown: number }> {
    const result = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, unknown: 0 };
    for (const issn of issns) {
      const q = await this.getQualityByIssn(issn);
      if (q?.sjrQuartile) result[q.sjrQuartile]++;
      else result.unknown++;
    }
    return result;
  }

  private async ensureLoaded(): Promise<void> {
    // Hâlâ güncel mi?
    if (this.table && Date.now() - this.lastLoaded < this.RELOAD_MS) return;
    // Yükleme sürüyorsa bekle
    if (this.loading) return this.loading;
    this.loading = this.loadTable().finally(() => { this.loading = null; });
    return this.loading;
  }

  /**
   * Yerel CSV dosyası yolu - Railway IP'leri SCImago'ya 403 gördüğü için
   * repo'da commit edilmiş snapshot öncelikli. Yol SCIMAGO_LOCAL_PATH env ile değiştirilebilir.
   */
  private getLocalPath(): string {
    if (process.env.SCIMAGO_LOCAL_PATH) return process.env.SCIMAGO_LOCAL_PATH;
    // Railway'de çalışma dizini: /app - bu da __dirname + assets/scimago-sjr.csv
    const candidates = [
      path.resolve(process.cwd(), 'assets/scimago-sjr.csv'),
      path.resolve(process.cwd(), 'backend/assets/scimago-sjr.csv'),
      path.resolve(__dirname, '../../assets/scimago-sjr.csv'),
      path.resolve(__dirname, '../../../assets/scimago-sjr.csv'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return candidates[0]; // ilkini döndür - yoksa yok sayılır
  }

  private async tryLocalFile(): Promise<boolean> {
    const p = this.getLocalPath();
    const attempt: typeof this.lastAttempt[0] = { url: `file://${p}` };
    try {
      if (!fs.existsSync(p)) {
        attempt.error = 'Dosya bulunamadı - scripts/fetch-scimago.mjs ile indirip commit edin';
        this.lastAttempt.push(attempt);
        return false;
      }
      const stat = fs.statSync(p);
      attempt.status = 200;
      attempt.contentType = `text/csv (${Math.round(stat.size / 1024)} KB)`;

      const text = fs.readFileSync(p, 'utf-8');
      attempt.bodyPreview = text.slice(0, 300).replace(/\n/g, ' ');

      const table = this.parseCsv(text);
      if (table.size === 0) {
        attempt.error = 'CSV parse edildi ancak 0 kayıt - başlık kolonları eşleşmemiş';
        this.lastAttempt.push(attempt);
        return false;
      }
      this.table = table;
      this.lastLoaded = Date.now();
      this.lastAttempt.push(attempt);
      this.logger.log(`SCImago yüklendi (yerel dosya): ${table.size} dergi kaydı - ${p}`);
      return true;
    } catch (e: any) {
      attempt.error = e.message;
      this.lastAttempt.push(attempt);
      return false;
    }
  }

  private async loadTable(): Promise<void> {
    this.lastAttempt = [];

    // 1) Yerel dosyayı dene (tercih edilir - Railway'de bu çalışır)
    if (await this.tryLocalFile()) return;

    // 2) URL'leri dene (lokal geliştirmede kullanışlı; Railway'de 403 yer)
    for (const url of this.candidateUrls) {
      const attempt: typeof this.lastAttempt[0] = { url };
      try {
        this.logger.log(`SCImago tablosu yükleniyor: ${url}`);
        const res = await fetch(url, {
          signal: AbortSignal.timeout(60000), // 60 sn - büyük dosya
          headers: {
            'User-Agent': 'mku-tto/1.0 (academic institution analytics)',
            'Accept': 'text/csv, application/csv, text/plain, */*',
          },
        });
        attempt.status = res.status;
        attempt.contentType = res.headers.get('content-type') || 'unknown';

        if (!res.ok) {
          attempt.error = `HTTP ${res.status} ${res.statusText}`;
          this.lastAttempt.push(attempt);
          this.logger.warn(`SCImago ${url}: ${attempt.error}`);
          continue;
        }

        const text = await res.text();
        attempt.bodyPreview = text.slice(0, 300).replace(/\n/g, ' ');

        // Beklenen format: CSV (; ayırıcılı, ilk satır 'Rank' içerir)
        if (!/rank|issn|title/i.test(text.slice(0, 200))) {
          attempt.error = 'CSV içeriği beklenen formatta değil (HTML veya boş yanıt?)';
          this.lastAttempt.push(attempt);
          this.logger.warn(`SCImago ${url}: ${attempt.error}`);
          continue;
        }

        const table = this.parseCsv(text);
        if (table.size === 0) {
          attempt.error = 'CSV parse edildi ancak 0 kayıt - başlık kolonları eşleşmemiş olabilir';
          this.lastAttempt.push(attempt);
          continue;
        }

        this.table = table;
        this.lastLoaded = Date.now();
        this.lastAttempt.push(attempt);
        this.logger.log(`SCImago yüklendi: ${table.size} dergi kaydı (${url})`);
        return;
      } catch (e: any) {
        attempt.error = e.message || String(e);
        this.lastAttempt.push(attempt);
        this.logger.warn(`SCImago ${url} yüklenemedi: ${e.message}`);
      }
    }
    this.logger.error('SCImago tablosu hiçbir URL\'den yüklenemedi - kalite bilgisi yok');
    this.logger.error(`Denenen URL'ler ve sonuçları: ${JSON.stringify(this.lastAttempt, null, 2)}`);
  }

  /** Son yükleme denemesinin detaylı raporu - diagnostic endpoint için */
  getLastAttemptReport(): { loaded: boolean; journalCount: number; lastLoadedAt: string | null; attempts: typeof this.lastAttempt } {
    return {
      loaded: this.isConfigured(),
      journalCount: this.getSize(),
      lastLoadedAt: this.lastLoaded ? new Date(this.lastLoaded).toISOString() : null,
      attempts: this.lastAttempt,
    };
  }

  /**
   * SCImago "xls" endpoint'i aslında CSV (';' ayırıcı, BOM'lu, UTF-8).
   * Kolonlar: Rank;Sourceid;Title;Type;Issn;SJR;SJR Best Quartile;H index;Total Docs. (2024); ...
   */
  private parseCsv(text: string): Map<string, JournalQuality> {
    const map = new Map<string, JournalQuality>();
    // BOM'u at
    text = text.replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return map;

    const headers = lines[0].split(';').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const colIssn      = headers.findIndex(h => h === 'issn');
    const colTitle     = headers.findIndex(h => h === 'title');
    const colType      = headers.findIndex(h => h === 'type');
    const colSjr       = headers.findIndex(h => h === 'sjr');
    const colQuartile  = headers.findIndex(h => h.includes('best quartile'));
    const colHIndex    = headers.findIndex(h => h === 'h index' || h === 'h-index');
    const colCountry   = headers.findIndex(h => h === 'country');
    const colPublisher = headers.findIndex(h => h === 'publisher');
    const colCategories= headers.findIndex(h => h === 'categories');

    if (colIssn === -1) {
      this.logger.warn('SCImago CSV başlıkları beklenen formatta değil');
      return map;
    }

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(';').map(c => c.replace(/^"|"$/g, '').trim());
      const issnField = cols[colIssn] || '';
      if (!issnField) continue;

      const sjrStr = (cols[colSjr] || '').replace(',', '.');
      const quartile = (cols[colQuartile] || '').toUpperCase() as 'Q1' | 'Q2' | 'Q3' | 'Q4' | '';
      const entry: JournalQuality = {
        issn: '',
        title: cols[colTitle],
        country: colCountry >= 0 ? cols[colCountry] : undefined,
        publisher: colPublisher >= 0 ? cols[colPublisher] : undefined,
        sjr: sjrStr ? parseFloat(sjrStr) : undefined,
        sjrQuartile: ['Q1','Q2','Q3','Q4'].includes(quartile) ? quartile as any : undefined,
        hIndex: colHIndex >= 0 && cols[colHIndex] ? parseInt(cols[colHIndex]) : undefined,
        categories: colCategories >= 0 && cols[colCategories]
          ? cols[colCategories].split(';').map(c => c.trim()).filter(Boolean)
          : undefined,
      };

      // Birden fazla ISSN olabilir (print + electronic) - hepsini indeksle
      const issns = issnField.split(/[,\s]+/).map(s => this.normalizeIssn(s)).filter(Boolean);
      for (const n of issns) {
        map.set(n, { ...entry, issn: n });
      }
    }
    return map;
  }

  private normalizeIssn(issn: string): string {
    return issn.trim().replace(/[^0-9xX]/g, '').toUpperCase();
  }

  /** Operasyonel: manuel yeniden yükleme */
  async refresh(): Promise<{ loaded: number; at: string }> {
    this.lastLoaded = 0;
    await this.ensureLoaded();
    return { loaded: this.getSize(), at: new Date(this.lastLoaded).toISOString() };
  }
}
