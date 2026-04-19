import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpCache } from './http-cache';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SCImago Journal Rank — dergi kalite ölçümleri.
 * SCImago public olarak yıllık CSV yayınlar: https://www.scimagojr.com/journalrank.php
 * Ücretsiz, anahtar gerektirmez.
 *
 * Strateji:
 *  - İlk istek geldiğinde SCImago CSV'si indirilir ve memory'de ISSN eşleştirme tablosu kurulur
 *  - Dosya 30 günde bir yenilenir
 *  - Her ISSN için en güncel yılın quartile + SJR skoru cache'lenir
 *
 * NOT: İndirme başarısız olursa entegrasyon "yapılandırılmadı" döner, sistem çökmez.
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
}

@Injectable()
export class ScimagoService implements OnModuleInit {
  private readonly logger = new Logger(ScimagoService.name);
  private readonly cache = new HttpCache('scimago');
  private table: Map<string, JournalQuality> | null = null;
  private loading: Promise<void> | null = null;
  private lastLoaded: number = 0;
  private readonly RELOAD_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün

  // Son yükleme denemesinin detaylı sonucu — debug için
  private lastAttempt: Array<{ url: string; status?: number; contentType?: string; bodyPreview?: string; error?: string }> = [];

  // SCImago yayın URL'ı — yıl otomatik geriye düşecek (son mevcut yıl)
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
    // İlk yüklemeyi zaman kazanmak için başlat, async — bloklamaz
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
   * ISSN'den kalite bilgisi. Çizgili veya çizgisiz ISSN kabul eder.
   */
  async getQualityByIssn(issn: string): Promise<JournalQuality | null> {
    if (!issn) return null;
    const normalized = this.normalizeIssn(issn);
    await this.ensureLoaded();
    if (!this.table) return null;
    return this.table.get(normalized) || null;
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
   * Başlıkla yaklaşık arama — ISSN yoksa son çare.
   */
  async findByTitle(title: string): Promise<JournalQuality | null> {
    if (!title || title.length < 4) return null;
    await this.ensureLoaded();
    if (!this.table) return null;
    const target = title.toLowerCase().trim();
    // Tam eşleşme önce
    for (const j of this.table.values()) {
      if (j.title?.toLowerCase() === target) return j;
    }
    // Sonra içerik eşleşmesi
    for (const j of this.table.values()) {
      if (j.title && j.title.toLowerCase().includes(target)) return j;
    }
    return null;
  }

  /** İstatistiksel veri — panel için */
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
   * Yerel CSV dosyası yolu — Railway IP'leri SCImago'ya 403 gördüğü için
   * repo'da commit edilmiş snapshot öncelikli. Yol SCIMAGO_LOCAL_PATH env ile değiştirilebilir.
   */
  private getLocalPath(): string {
    if (process.env.SCIMAGO_LOCAL_PATH) return process.env.SCIMAGO_LOCAL_PATH;
    // Railway'de çalışma dizini: /app — bu da __dirname + assets/scimago-sjr.csv
    const candidates = [
      path.resolve(process.cwd(), 'assets/scimago-sjr.csv'),
      path.resolve(process.cwd(), 'backend/assets/scimago-sjr.csv'),
      path.resolve(__dirname, '../../assets/scimago-sjr.csv'),
      path.resolve(__dirname, '../../../assets/scimago-sjr.csv'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return candidates[0]; // ilkini döndür — yoksa yok sayılır
  }

  private async tryLocalFile(): Promise<boolean> {
    const p = this.getLocalPath();
    const attempt: typeof this.lastAttempt[0] = { url: `file://${p}` };
    try {
      if (!fs.existsSync(p)) {
        attempt.error = 'Dosya bulunamadı — scripts/fetch-scimago.mjs ile indirip commit edin';
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
        attempt.error = 'CSV parse edildi ancak 0 kayıt — başlık kolonları eşleşmemiş';
        this.lastAttempt.push(attempt);
        return false;
      }
      this.table = table;
      this.lastLoaded = Date.now();
      this.lastAttempt.push(attempt);
      this.logger.log(`SCImago yüklendi (yerel dosya): ${table.size} dergi kaydı — ${p}`);
      return true;
    } catch (e: any) {
      attempt.error = e.message;
      this.lastAttempt.push(attempt);
      return false;
    }
  }

  private async loadTable(): Promise<void> {
    this.lastAttempt = [];

    // 1) Yerel dosyayı dene (tercih edilir — Railway'de bu çalışır)
    if (await this.tryLocalFile()) return;

    // 2) URL'leri dene (lokal geliştirmede kullanışlı; Railway'de 403 yer)
    for (const url of this.candidateUrls) {
      const attempt: typeof this.lastAttempt[0] = { url };
      try {
        this.logger.log(`SCImago tablosu yükleniyor: ${url}`);
        const res = await fetch(url, {
          signal: AbortSignal.timeout(60000), // 60 sn — büyük dosya
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
          attempt.error = 'CSV parse edildi ancak 0 kayıt — başlık kolonları eşleşmemiş olabilir';
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
    this.logger.error('SCImago tablosu hiçbir URL\'den yüklenemedi — kalite bilgisi yok');
    this.logger.error(`Denenen URL'ler ve sonuçları: ${JSON.stringify(this.lastAttempt, null, 2)}`);
  }

  /** Son yükleme denemesinin detaylı raporu — diagnostic endpoint için */
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

      // Birden fazla ISSN olabilir (print + electronic) — hepsini indeksle
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
