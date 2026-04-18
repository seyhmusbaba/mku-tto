import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const NodeCache = require('node-cache');

// Scopus API rate limit: haftada ~20.000 istek. Önbellekleme zorunlu.
const cache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 }); // 24 saat TTL

@Injectable()
export class ScopusService {
  private readonly BASE = 'https://api.elsevier.com';

  private get apiKey(): string {
    return process.env.SCOPUS_API_KEY || '';
  }

  private get instToken(): string {
    return process.env.SCOPUS_INST_TOKEN || '';
  }

  private headers() {
    const h: Record<string, string> = {
      'X-ELS-APIKey': this.apiKey,
      'Accept': 'application/json',
    };
    if (this.instToken) h['X-ELS-Insttoken'] = this.instToken;
    return h;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  // Önbellek temizle (sync sırasında kullanılır)
  clearCache(key: string) {
    cache.del(key);
  }

  clearAllCache() {
    cache.flushAll();
  }

  // ── YAZAR PROFİLİ ─────────────────────────────────────────────
  // Author Retrieval API kurumsal erişim gerektiriyor.
  // Search API üzerinden yayın listesinden metrikleri kendimiz hesaplıyoruz.
  async getAuthorProfile(scopusAuthorId: string) {
    const cacheKey = `author:${scopusAuthorId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      // subject-areas field parametresi hata verdiği için hariç tutuyoruz
      const url = `${this.BASE}/content/search/scopus?query=AU-ID(${scopusAuthorId})&count=200&sort=-citedby-count&field=dc:title,prism:coverDate,citedby-count,dc:identifier`;
      const res = await fetch(url, { headers: this.headers(), signal: AbortSignal.timeout(20000) });
      if (!res.ok) return null;
      const data = await res.json();

      const entries: any[] = data?.['search-results']?.['entry'] || [];
      const totalResults = +(data?.['search-results']?.['opensearch:totalResults'] || 0);
      if (!entries.length) return null;

      // Toplam atıf
      const citedByCount = entries.reduce((s, e) => s + +(e['citedby-count'] || 0), 0);

      // h-index: azalan sırada, atıf >= sıra olan son nokta
      const sorted = entries.map(e => +(e['citedby-count'] || 0)).sort((a, b) => b - a);
      let hIndex = 0;
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i] >= i + 1) hIndex = i + 1; else break;
      }

      const profile = {
        scopusId:      scopusAuthorId,
        hIndex,
        citedByCount,
        documentCount: totalResults,
        subjectAreas:  [],
        coauthorCount: 0,
        affiliation:   '',
        note: totalResults > 200 ? `${totalResults} yayından ilk 200'e göre hesaplandı` : null,
      };

      cache.set(cacheKey, profile);
      return profile;
    } catch {
      return null;
    }
  }

  // ── YAZAR YAYINLARI ───────────────────────────────────────────
  async getAuthorPublications(scopusAuthorId: string, limit = 20) {
    const cacheKey = `pubs:${scopusAuthorId}:${limit}`;
    const cached = cache.get(cacheKey) as any[];
    if (cached) return cached;

    try {
      const url = `${this.BASE}/content/search/scopus?query=AU-ID(${scopusAuthorId})&count=${limit}&sort=-pubyear&field=dc:title,prism:publicationName,prism:coverDate,citedby-count,prism:doi,dc:identifier,authkeywords`;
      const res = await fetch(url, { headers: this.headers(), signal: AbortSignal.timeout(15000) });
      if (!res.ok) return [];
      const data = await res.json();

      const entries = data?.['search-results']?.['entry'] || [];
      const pubs = entries.map((e: any) => ({
        scopusId:  e['dc:identifier']?.replace('SCOPUS_ID:', '') || '',
        title:     e['dc:title'] || '',
        journal:   e['prism:publicationName'] || '',
        year:      e['prism:coverDate']?.substring(0, 4) || '',
        citedBy:   +(e['citedby-count'] || 0),
        doi:       e['prism:doi'] || '',
        keywords:  e['authkeywords'] || '',
      }));

      cache.set(cacheKey, pubs);
      return pubs;
    } catch {
      return [];
    }
  }

  // ── PROJE İÇİN ALAKALI YAYINLAR ──────────────────────────────
  // Proje başlığı + anahtar kelime + yazar listesine göre Scopus'ta arama
  async findRelatedPublications(opts: {
    title: string;
    keywords: string[];
    authorScopusIds: string[];
    limit?: number;
  }) {
    const limit = opts.limit || 10;
    const cacheKey = `related:${opts.title.substring(0, 30)}:${opts.authorScopusIds.join(',')}`;
    const cached = cache.get(cacheKey) as any[];
    if (cached) return cached;

    try {
      // Arama stratejisi: yazarlar + anahtar kelimeler
      let query = '';
      if (opts.authorScopusIds.length > 0) {
        query = opts.authorScopusIds.map(id => `AU-ID(${id})`).join(' OR ');
        if (opts.keywords.length > 0) {
          const kwPart = opts.keywords.slice(0, 3).map(k => `KEY("${k}")`).join(' OR ');
          query = `(${query}) AND (${kwPart})`;
        }
      } else if (opts.keywords.length > 0) {
        query = opts.keywords.slice(0, 5).map(k => `KEY("${k}")`).join(' OR ');
      } else {
        query = `TITLE("${opts.title.substring(0, 60)}")`;
      }

      const url = `${this.BASE}/content/search/scopus?query=${encodeURIComponent(query)}&count=${limit}&sort=-pubyear&field=dc:title,prism:publicationName,prism:coverDate,citedby-count,prism:doi,dc:identifier,dc:creator`;
      const res = await fetch(url, { headers: this.headers(), signal: AbortSignal.timeout(20000) });
      if (!res.ok) return [];
      const data = await res.json();

      const entries = data?.['search-results']?.['entry'] || [];
      const pubs = entries.map((e: any) => ({
        scopusId: e['dc:identifier']?.replace('SCOPUS_ID:', '') || '',
        title: e['dc:title'] || '',
        journal: e['prism:publicationName'] || '',
        year: e['prism:coverDate']?.substring(0, 4) || '',
        citedBy: +(e['citedby-count'] || 0),
        doi: e['prism:doi'] || '',
        firstAuthor: e['dc:creator'] || '',
      }));

      cache.set(cacheKey, pubs, 43200); // 12 saat
      return pubs;
    } catch {
      return [];
    }
  }

  // ── DÜNYADA BENZER ÇALIŞMALAR ─────────────────────────────────
  // Proje başlığı + açıklama bazında dünya literatüründe benzer araştırma tespiti
  async findSimilarResearch(opts: {
    title: string;
    description?: string;
    keywords?: string[];
    limit?: number;
  }) {
    const limit = opts.limit || 8;
    const cacheKey = `similar:${opts.title.substring(0, 50)}`;
    const cached = cache.get(cacheKey) as any[];
    if (cached) return cached;

    try {
      // Başlık + anahtar kelime ile arama
      const terms = [
        `TITLE("${opts.title.substring(0, 80)}")`,
        ...(opts.keywords || []).slice(0, 3).map(k => `KEY("${k}")`),
      ];
      const query = terms.join(' OR ');

      const url = `${this.BASE}/content/search/scopus?query=${encodeURIComponent(query)}&count=${limit}&sort=-citedby-count&field=dc:title,prism:publicationName,prism:coverDate,citedby-count,prism:doi,dc:identifier,dc:creator,affil`;
      const res = await fetch(url, { headers: this.headers(), signal: AbortSignal.timeout(20000) });
      if (!res.ok) return [];
      const data = await res.json();
      const total = +(data?.['search-results']?.['opensearch:totalResults'] || 0);

      const entries = data?.['search-results']?.['entry'] || [];
      const results = entries.map((e: any) => ({
        scopusId: e['dc:identifier']?.replace('SCOPUS_ID:', '') || '',
        title: e['dc:title'] || '',
        journal: e['prism:publicationName'] || '',
        year: e['prism:coverDate']?.substring(0, 4) || '',
        citedBy: +(e['citedby-count'] || 0),
        doi: e['prism:doi'] || '',
        firstAuthor: e['dc:creator'] || '',
      }));

      const out = { total, results };
      cache.set(cacheKey, out, 43200);
      return out;
    } catch {
      return { total: 0, results: [] };
    }
  }

  // ── HİBE UYGUNLUK ANALİZİ ─────────────────────────────────────
  // Proje anahtar kelimelerine göre Scopus ASJC konu kodları bulunur,
  // bu kodlar aktif fon kaynaklarıyla eşleştirilir
  async getSubjectAreaMatch(keywords: string[], projectType?: string) {
    if (!keywords.length) return [];
    const cacheKey = `subject:${keywords.slice(0, 4).join(',')}`;
    const cached = cache.get(cacheKey) as any[];
    if (cached) return cached;

    try {
      const query = keywords.slice(0, 5).map(k => `KEY("${k}")`).join(' OR ');
      const url = `${this.BASE}/content/search/scopus?query=${encodeURIComponent(query)}&count=25&field=subject-area`;
      const res = await fetch(url, { headers: this.headers(), signal: AbortSignal.timeout(15000) });
      if (!res.ok) return [];
      const data = await res.json();

      // Konu alanlarını say ve sırala
      const areaCounts: Record<string, number> = {};
      (data?.['search-results']?.['entry'] || []).forEach((e: any) => {
        const areas = e['subject-areas']?.['subject-area'] || [];
        areas.forEach((a: any) => {
          const code = a['@abbrev'] || '';
          if (code) areaCounts[code] = (areaCounts[code] || 0) + 1;
        });
      });

      const sorted = Object.entries(areaCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([code, count]) => ({ code, count, label: ASJC_LABELS[code] || code }));

      cache.set(cacheKey, sorted, 86400);
      return sorted;
    } catch {
      return [];
    }
  }

  // ── FAKÜLTE SCOPUSMETRİKLERİ ──────────────────────────────────
  // Bir fakültedeki akademisyenlerin Scopus metriklerini toplar
  async getFacultyMetrics(scopusAuthorIds: string[]) {
    if (!scopusAuthorIds.length) return { totalCitations: 0, totalDocuments: 0, avgHIndex: 0, topSubjects: [] };

    const profiles = await Promise.all(
      scopusAuthorIds.slice(0, 20).map(id => this.getAuthorProfile(id).catch(() => null))
    );
    const valid = profiles.filter(Boolean) as any[];

    const totalCitations  = valid.reduce((s, p) => s + (p.citedByCount || 0), 0);
    const totalDocuments  = valid.reduce((s, p) => s + (p.documentCount || 0), 0);
    const avgHIndex       = valid.length > 0 ? Math.round(valid.reduce((s, p) => s + (p.hIndex || 0), 0) / valid.length) : 0;
    const subjectCounts: Record<string, number> = {};
    valid.forEach(p => (p.subjectAreas || []).forEach((a: string) => { subjectCounts[a] = (subjectCounts[a] || 0) + 1; }));
    const topSubjects = Object.entries(subjectCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([code, count]) => ({ code, count, label: ASJC_LABELS[code] || code }));

    return { totalCitations, totalDocuments, avgHIndex, topSubjects, authorCount: valid.length };
  }
}

// Scopus ASJC konu kodu → Türkçe etiket (sık kullanılanlar)
const ASJC_LABELS: Record<string, string> = {
  COMP: 'Bilgisayar Bilimi',
  ENGI: 'Mühendislik',
  MEDI: 'Tıp',
  MATH: 'Matematik',
  PHYS: 'Fizik',
  CHEM: 'Kimya',
  BIOC: 'Biyokimya',
  AGRI: 'Tarım',
  ENVI: 'Çevre',
  MATE: 'Malzeme Bilimi',
  SOCI: 'Sosyal Bilimler',
  ECON: 'Ekonomi',
  ENER: 'Enerji',
  EART: 'Yer Bilimleri',
  NURS: 'Hemşirelik',
  DENT: 'Diş Hekimliği',
  PHAR: 'Eczacılık',
  VETE: 'Veterinerlik',
  ARTS: 'Sanat & Beşeri',
  PSYC: 'Psikoloji',
  BUSI: 'İşletme',
  DECI: 'Karar Bilimleri',
  IMMU: 'İmmünoloji',
  NEUR: 'Nörobilim',
  MULT: 'Çok Disiplinli',
};
