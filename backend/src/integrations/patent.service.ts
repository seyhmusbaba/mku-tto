import { Injectable, Logger } from '@nestjs/common';
import { HttpCache, RateLimiter, fetchJson } from './http-cache';

/**
 * Patent arama / doğrulama servisi.
 *
 * Primary: EPO OPS (European Patent Office — Open Patent Services)
 * - Türk patentleri (TR kind code) dahil, dünyanın tüm büyük patent ofislerini indeksler
 * - Resmi REST API, OAuth2 client credentials
 * - Ücretsiz tier: ayda 4 GB trafik, 200 request/dakika
 * - Kayıt: https://developers.epo.org/
 * - Gereken env: EPO_CONSUMER_KEY, EPO_CONSUMER_SECRET
 *
 * TÜRKPATENT'in doğrudan public JSON API'si yok — EPATENT kurumsal girişli.
 * EPO OPS yoluyla TR patentleri doğrularız; bu endüstri standartıdır.
 */

export interface PatentRecord {
  publicationNumber: string;         // EP, TR, US vs. + sayı (örn. TR2022012345, EP3456789)
  applicationNumber?: string;
  title: string;
  titleOriginal?: string;
  applicants: string[];
  inventors?: string[];
  applicationDate?: string;
  publicationDate?: string;
  country?: string;                  // TR, EP, US, WO...
  kindCode?: string;                 // A1, A2, B1...
  ipcClasses?: string[];
  cpcClasses?: string[];
  abstract?: string;
  familyId?: string;
  legalStatus?: string;
}

@Injectable()
export class PatentService {
  private readonly logger = new Logger(PatentService.name);
  private readonly cache = new HttpCache('patent');
  private readonly limiter = new RateLimiter(3, 1000);

  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  isConfigured(): boolean {
    return !!(process.env.EPO_CONSUMER_KEY && process.env.EPO_CONSUMER_SECRET);
  }

  /**
   * OAuth2 token al — 20 dk geçerli, cache'le.
   */
  private async getToken(): Promise<string | null> {
    if (!this.isConfigured()) return null;
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }
    try {
      const creds = Buffer.from(`${process.env.EPO_CONSUMER_KEY}:${process.env.EPO_CONSUMER_SECRET}`).toString('base64');
      const res = await fetch('https://ops.epo.org/3.2/auth/accesstoken', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${creds}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        this.logger.warn(`EPO OPS token fail: HTTP ${res.status}`);
        return null;
      }
      const data = await res.json();
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in || 1200) * 1000;
      return this.accessToken;
    } catch (e: any) {
      this.logger.warn(`EPO OPS token error: ${e.message}`);
      return null;
    }
  }

  /**
   * Yayın numarasından patent bilgisi (örn. TR2022012345, EP3456789).
   */
  async getByPublicationNumber(pub: string): Promise<PatentRecord | null> {
    if (!pub) return null;
    const cleaned = pub.replace(/[\s\/\-]/g, '').toUpperCase();
    const cacheKey = `pub:${cleaned}`;
    const cached = this.cache.get<PatentRecord | null>(cacheKey);
    if (cached !== undefined) return cached;

    const token = await this.getToken();
    if (!token) return null;

    try {
      await this.limiter.acquire();
      const url = `https://ops.epo.org/3.2/rest-services/published-data/publication/docdb/${encodeURIComponent(cleaned)}/biblio`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        this.cache.set(cacheKey, null, 60 * 60);
        return null;
      }
      const data = await res.json();
      const record = this.mapEpoBiblio(data, cleaned);
      this.cache.set(cacheKey, record, 60 * 60 * 24 * 7);
      return record;
    } catch (e: any) {
      this.logger.warn(`EPO OPS lookup failed: ${e.message}`);
      return null;
    }
  }

  /**
   * Anahtar kelime (başlık + özet) bazlı patent araması.
   * EPO OPS CQL'inde `txt` alanı başlık + özet içinde arama yapar.
   * Prior art analizi için DOĞRU yöntem budur — başvuru sahibi adı değil.
   */
  async searchByKeyword(query: string, country?: string, limit = 25): Promise<PatentRecord[]> {
    if (!query) return [];
    const cacheKey = `kw:${country || 'ALL'}:${query.toLowerCase()}:${limit}`;
    const cached = this.cache.get<PatentRecord[]>(cacheKey);
    if (cached) return cached;

    const token = await this.getToken();
    if (!token) return [];

    try {
      await this.limiter.acquire();
      // CQL: `txt=<phrase>` (başlık+özette arar) + opsiyonel ülke filtresi
      const cqlParts = [`txt="${query.replace(/"/g, '')}"`];
      if (country) cqlParts.push(`pn=${country}`);
      const cql = cqlParts.join(' AND ');
      const url = `https://ops.epo.org/3.2/rest-services/published-data/search/biblio?q=${encodeURIComponent(cql)}&Range=1-${Math.min(limit, 100)}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      const items = this.mapEpoSearch(data);
      this.cache.set(cacheKey, items, 60 * 60 * 12);
      return items;
    } catch (e: any) {
      this.logger.warn(`EPO OPS keyword search failed: ${e.message}`);
      return [];
    }
  }

  /**
   * Başvuru sahibine (kurum/kişi) göre patent araması.
   * CQL (Contextual Query Language) kullanılır.
   */
  async searchByApplicant(applicantName: string, country = 'TR', limit = 25): Promise<PatentRecord[]> {
    if (!applicantName) return [];
    const cacheKey = `applicant:${country}:${applicantName.toLowerCase()}:${limit}`;
    const cached = this.cache.get<PatentRecord[]>(cacheKey);
    if (cached) return cached;

    const token = await this.getToken();
    if (!token) return [];

    try {
      await this.limiter.acquire();
      const cql = `pa="${applicantName}" AND pn=${country}`;
      const url = `https://ops.epo.org/3.2/rest-services/published-data/search/biblio?q=${encodeURIComponent(cql)}&Range=1-${Math.min(limit, 100)}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      const items = this.mapEpoSearch(data);
      this.cache.set(cacheKey, items, 60 * 60 * 24);
      return items;
    } catch (e: any) {
      this.logger.warn(`EPO OPS applicant search failed: ${e.message}`);
      return [];
    }
  }

  /**
   * Projede belirtilen IP numarasının gerçekten iddia edilen kuruma ait olup olmadığını doğrula.
   */
  async verifyOwnership(
    publicationNumber: string,
    expectedApplicantSubstring: string,
  ): Promise<{ verified: boolean; record: PatentRecord | null; reason?: string }> {
    const record = await this.getByPublicationNumber(publicationNumber);
    if (!record) return { verified: false, record: null, reason: 'Patent kaydı bulunamadı (EPO OPS)' };
    const needle = expectedApplicantSubstring.trim().toLowerCase();
    const match = record.applicants.some(a => a.toLowerCase().includes(needle));
    return {
      verified: match,
      record,
      reason: match ? undefined : `Başvuru sahibi listesinde eşleşme yok: ${record.applicants.join(', ')}`,
    };
  }

  // ── Mappers ───────────────────────────────────────────────────────────

  private mapEpoBiblio(data: any, requested: string): PatentRecord | null {
    const exchange = data?.['ops:world-patent-data']?.['exchange-documents']?.['exchange-document'];
    if (!exchange) return null;
    const doc = Array.isArray(exchange) ? exchange[0] : exchange;
    if (!doc) return null;

    const biblio = doc['bibliographic-data'] || {};

    // Publication reference
    const pubRef = biblio['publication-reference']?.['document-id'];
    const pubArr = Array.isArray(pubRef) ? pubRef : [pubRef];
    const docdb = pubArr.find((p: any) => p?.['@document-id-type'] === 'docdb') || pubArr[0];
    const country = docdb?.country?.$ || docdb?.country || '';
    const num = docdb?.['doc-number']?.$ || docdb?.['doc-number'] || '';
    const kind = docdb?.kind?.$ || docdb?.kind || '';
    const publicationNumber = (country + num + kind) || requested;

    // Application reference
    const appRef = biblio['application-reference']?.['document-id'];
    const appArr = Array.isArray(appRef) ? appRef : [appRef];
    const appDocdb = appArr.find((p: any) => p?.['@document-id-type'] === 'docdb') || appArr[0];
    const applicationNumber = appDocdb ? ((appDocdb.country?.$ || '') + (appDocdb['doc-number']?.$ || '')) : undefined;

    // Title
    const titles = biblio['invention-title'];
    const titleArr = Array.isArray(titles) ? titles : titles ? [titles] : [];
    const en = titleArr.find((t: any) => t?.['@lang'] === 'en');
    const tr = titleArr.find((t: any) => t?.['@lang'] === 'tr');
    const any = titleArr[0];
    const title = (en?.$ || en || any?.$ || any || '').toString();
    const titleOriginal = tr?.$ || tr?.toString();

    // Applicants
    const applicantsData = biblio.parties?.applicants?.applicant;
    const applicantsArr = Array.isArray(applicantsData) ? applicantsData : applicantsData ? [applicantsData] : [];
    const applicants = applicantsArr
      .filter((a: any) => a?.['@data-format'] === 'epodoc' || !a?.['@data-format'])
      .map((a: any) => a?.['applicant-name']?.name?.$ || a?.['applicant-name']?.name || '')
      .filter(Boolean);

    // Inventors
    const invData = biblio.parties?.inventors?.inventor;
    const invArr = Array.isArray(invData) ? invData : invData ? [invData] : [];
    const inventors = invArr
      .filter((a: any) => a?.['@data-format'] === 'epodoc' || !a?.['@data-format'])
      .map((a: any) => a?.['inventor-name']?.name?.$ || a?.['inventor-name']?.name || '')
      .filter(Boolean);

    // IPC
    const ipcData = biblio['classifications-ipcr']?.['classification-ipcr'];
    const ipcArr = Array.isArray(ipcData) ? ipcData : ipcData ? [ipcData] : [];
    const ipcClasses = ipcArr.map((c: any) => (c?.text?.$ || c?.text || '').toString().trim()).filter(Boolean);

    // Dates
    const applicationDate = appDocdb?.date?.$ || undefined;
    const publicationDate = docdb?.date?.$ || undefined;

    // Abstract
    const absData = doc.abstract;
    const absArr = Array.isArray(absData) ? absData : absData ? [absData] : [];
    const absEn = absArr.find((a: any) => a?.['@lang'] === 'en') || absArr[0];
    const abstract = absEn?.p?.$ || absEn?.p || undefined;

    return {
      publicationNumber,
      applicationNumber,
      title,
      titleOriginal,
      applicants,
      inventors,
      applicationDate,
      publicationDate,
      country,
      kindCode: kind,
      ipcClasses,
      abstract: typeof abstract === 'string' ? abstract : undefined,
    };
  }

  private mapEpoSearch(data: any): PatentRecord[] {
    const refs = data?.['ops:world-patent-data']?.['ops:biblio-search']?.['ops:search-result']?.['ops:publication-reference'];
    if (!refs) return [];
    const arr = Array.isArray(refs) ? refs : [refs];
    return arr
      .map((r: any) => {
        const docId = r?.['document-id'];
        const docdb = Array.isArray(docId) ? docId.find((d: any) => d?.['@document-id-type'] === 'docdb') : docId;
        if (!docdb) return null;
        const c = docdb.country?.$ || '';
        const n = docdb['doc-number']?.$ || '';
        const k = docdb.kind?.$ || '';
        return {
          publicationNumber: c + n + k,
          title: '',
          applicants: [],
          country: c,
          kindCode: k,
        } as PatentRecord;
      })
      .filter(Boolean) as PatentRecord[];
  }
}
