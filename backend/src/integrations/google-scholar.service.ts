import { Injectable, Logger } from '@nestjs/common';
import { HttpCache } from './http-cache';

/**
 * Google Scholar HTML scraping - SADECE sayı metrikleri için.
 *
 * UYARI: Google'ın resmi API'si yok ve scraping ToS ihlali. Bu servis:
 *   - Tek bir author profil sayfasını çeker (scraping değil, public görüntüleme)
 *   - 7 gün cache'ler (agresif olmamak için)
 *   - CAPTCHA tespit ederse sessizce null döner (sistem çökmez)
 *   - Railway datacenter IP'sinden bazı istekler 429/CAPTCHA alabilir -
 *     bu durumda manuel giriş alternatifi olarak cache boş kalır
 *
 * Alternatif: SerpAPI (ücretli, legal proxy) - SERPAPI_KEY env ile ayarlanırsa
 * öncelik kazanır.
 */
@Injectable()
export class GoogleScholarService {
  private readonly logger = new Logger(GoogleScholarService.name);
  private readonly cache = new HttpCache('scholar');

  private readonly USER_AGENTS = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  ];

  async getAuthorMetrics(scholarId: string): Promise<{
    citations: number;
    hIndex: number;
    i10Index: number;
    docCount: number;
  } | null> {
    if (!scholarId) return null;

    const cacheKey = `metrics:${scholarId}`;
    const cached = this.cache.get<any>(cacheKey);
    if (cached !== undefined) return cached;

    // SerpAPI varsa önce onu dene (legal ve güvenilir)
    if (process.env.SERPAPI_KEY) {
      const viaSerp = await this.fetchViaSerpApi(scholarId).catch(() => null);
      if (viaSerp) {
        this.cache.set(cacheKey, viaSerp, 60 * 60 * 24 * 7);
        return viaSerp;
      }
    }

    // Direkt HTML scraping - Railway'de bazen 429/CAPTCHA alabilir
    const result = await this.scrapeHtml(scholarId);
    if (result) {
      this.cache.set(cacheKey, result, 60 * 60 * 24 * 7);
    } else {
      // Başarısız sonucu da kısa süre cache'le - sürekli retry olmasın
      this.cache.set(cacheKey, null, 60 * 60 * 2);
    }
    return result;
  }

  private async scrapeHtml(scholarId: string): Promise<{
    citations: number;
    hIndex: number;
    i10Index: number;
    docCount: number;
  } | null> {
    try {
      const ua = this.USER_AGENTS[Math.floor(Math.random() * this.USER_AGENTS.length)];
      const url = `https://scholar.google.com/citations?user=${encodeURIComponent(scholarId)}&hl=en&pagesize=100`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': ua,
          'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Referer': 'https://scholar.google.com/',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        this.logger.warn(`[Scholar] HTTP ${res.status} - ${scholarId}`);
        return null;
      }

      const html = await res.text();

      // CAPTCHA/sorry/robot check
      if (
        html.includes('/sorry/') ||
        html.includes('unusual traffic') ||
        html.includes('Our systems have detected') ||
        html.length < 1000
      ) {
        this.logger.warn(`[Scholar] CAPTCHA/bot engeli - ${scholarId}`);
        return null;
      }

      // Metrik tablosu: <td class="gsc_rsb_std">NNN</td> ×6
      // Sıra: citations-all, citations-since, h-all, h-since, i10-all, i10-since
      const statRegex = /class="gsc_rsb_std"[^>]*>(\d+)</g;
      const stats: number[] = [];
      let m: RegExpExecArray | null;
      while ((m = statRegex.exec(html)) !== null) {
        stats.push(parseInt(m[1], 10));
      }

      if (stats.length < 6) {
        this.logger.warn(`[Scholar] Metrik tablosu parse edilemedi - ${scholarId} (${stats.length} değer)`);
        return null;
      }

      // Makaleler - gsc_a_tr satır sayısı (pagesize=100 ile ilk 100 görünür)
      const articleMatches = html.match(/class="gsc_a_tr"/g) || [];
      const docCount = articleMatches.length;

      const result = {
        citations: stats[0],
        hIndex: stats[2],
        i10Index: stats[4],
        docCount,
      };

      this.logger.log(`[Scholar] ${scholarId}: ${result.citations} atıf, h=${result.hIndex}, ${result.docCount} yayın`);
      return result;
    } catch (e: any) {
      this.logger.warn(`[Scholar] Scraping hatası ${scholarId}: ${e.message}`);
      return null;
    }
  }

  /**
   * SerpAPI proxy - legal alternatif. SERPAPI_KEY env varsa kullanılır.
   * https://serpapi.com/google-scholar-author-api
   */
  private async fetchViaSerpApi(scholarId: string): Promise<{
    citations: number;
    hIndex: number;
    i10Index: number;
    docCount: number;
  } | null> {
    const key = process.env.SERPAPI_KEY;
    if (!key) return null;

    try {
      const url = `https://serpapi.com/search.json?engine=google_scholar_author&author_id=${encodeURIComponent(scholarId)}&api_key=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) return null;
      const data = await res.json();
      const tbl = data?.cited_by?.table?.[0] || {};
      const citations = tbl.citations?.all || 0;
      const hRow = data?.cited_by?.table?.[1]?.h_index?.all || 0;
      const i10Row = data?.cited_by?.table?.[2]?.i10_index?.all || 0;
      const articles = Array.isArray(data?.articles) ? data.articles.length : 0;
      this.logger.log(`[Scholar/SerpAPI] ${scholarId}: ${citations} atıf, h=${hRow}`);
      return { citations, hIndex: hRow, i10Index: i10Row, docCount: articles };
    } catch (e: any) {
      this.logger.warn(`[Scholar/SerpAPI] Hata ${scholarId}: ${e.message}`);
      return null;
    }
  }

  isConfigured(): boolean {
    return true; // Her zaman dener; başarısız olursa null döner
  }
}
