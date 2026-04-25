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
  // Ücretsiz API max count=25. İki ayrı istek: atıf sırası + konu alanı.
  async getAuthorProfile(scopusAuthorId: string) {
    const cacheKey = `author:${scopusAuthorId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      // Author Retrieval API - h-index, citation-count, document-count direkt gelir
      // (ücretsiz Scopus API'de çalışır: /content/author/author_id/{id})
      const authorUrl = `${this.BASE}/content/author/author_id/${scopusAuthorId}?view=METRICS`;
      const aRes = await fetch(authorUrl, { headers: this.headers(), signal: AbortSignal.timeout(20000) });

      let hIndex = 0;
      let citedByCount = 0;
      let totalResults = 0;
      let directMetrics = false;

      if (aRes.ok) {
        const aData = await aRes.json();
        const retr = aData?.['author-retrieval-response']?.[0] || aData?.['author-retrieval-response'];
        const coredata = retr?.['coredata'] || {};
        const metrics = retr?.['h-index'] || coredata['h-index'];
        if (metrics || coredata['citation-count']) {
          hIndex = +(coredata['h-index'] || retr?.['h-index'] || 0);
          citedByCount = +(coredata['citation-count'] || 0);
          totalResults = +(coredata['document-count'] || 0);
          directMetrics = true;
        }
      }

      // Fallback: eski yöntem (arama endpoint'i) - Author Retrieval izin vermiyorsa
      const url = `${this.BASE}/content/search/scopus?query=AU-ID(${scopusAuthorId})&count=25&sort=-citedby-count&field=dc:title,prism:coverDate,citedby-count,dc:identifier`;
      const res = await fetch(url, { headers: this.headers(), signal: AbortSignal.timeout(20000) });
      if (!res.ok && !directMetrics) return null;
      const data = res.ok ? await res.json() : { 'search-results': { entry: [] } };

      const entries: any[] = data?.['search-results']?.['entry'] || [];
      if (!directMetrics) {
        totalResults = +(data?.['search-results']?.['opensearch:totalResults'] || 0);
        if (!entries.length) return null;

        // Sadece arama endpoint'i varsa en çok atıf alan 25'ten hesapla
        citedByCount = entries.reduce((s, e) => s + +(e['citedby-count'] || 0), 0);
        const sortedCites = entries.map(e => +(e['citedby-count'] || 0)).sort((a, b) => b - a);
        for (let i = 0; i < sortedCites.length; i++) {
          if (sortedCites[i] >= i + 1) hIndex = i + 1; else break;
        }
      }

      // İstek 2: konu alanları (opsiyonel)
      let subjectAreas: string[] = [];
      try {
        const url2 = `${this.BASE}/content/search/scopus?query=AU-ID(${scopusAuthorId})&count=25&sort=-pubyear&field=subject-areas`;
        const res2 = await fetch(url2, { headers: this.headers(), signal: AbortSignal.timeout(15000) });
        if (res2.ok) {
          const data2 = await res2.json();
          const areaCounts: Record<string, number> = {};
          (data2?.['search-results']?.['entry'] || []).forEach((e: any) => {
            const areas = e['subject-areas']?.['subject-area'] || [];
            (Array.isArray(areas) ? areas : [areas]).forEach((a: any) => {
              const code = a?.['@abbrev'] || '';
              if (code) areaCounts[code] = (areaCounts[code] || 0) + 1;
            });
          });
          subjectAreas = Object.entries(areaCounts)
            .sort(([, a], [, b]) => b - a).slice(0, 5)
            .map(([code]) => ASJC_LABELS[code] || code);
        }
      } catch { /* opsiyonel */ }

      const profile = {
        scopusId:      scopusAuthorId,
        hIndex,
        citedByCount,
        documentCount: totalResults,
        subjectAreas,
        coauthorCount: 0,
        affiliation:   '',
        note: totalResults > 25 ? `${totalResults} yayından ilk 25'e göre hesaplandı` : null,
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
      const url = `${this.BASE}/content/search/scopus?query=AU-ID(${scopusAuthorId})&count=${Math.min(limit, 25)}&sort=-pubyear&field=dc:title,prism:publicationName,prism:coverDate,citedby-count,prism:doi,dc:identifier,authkeywords`;
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
    const cached = cache.get(cacheKey);
    if (cached && Array.isArray(cached)) return cached;

    try {
      let query = '';
      if (opts.authorScopusIds.length > 0) {
        query = opts.authorScopusIds.map(id => `AU-ID(${id})`).join(' OR ');
        if (opts.keywords.length >= 3) {
          const kws = opts.keywords.slice(0, 3).map(k => `KEY("${k}")`).join(' OR ');
          query = `(${query}) AND (${kws})`;
        }
      } else if (opts.keywords.length >= 2) {
        query = opts.keywords.slice(0, 4).map(k => `KEY("${k}")`).join(' AND ');
      } else if (opts.keywords.length === 1) {
        query = `KEY("${opts.keywords[0]}")`;
      } else {
        return [];
      }

      const url = `${this.BASE}/content/search/scopus?query=${encodeURIComponent(query)}&count=${Math.min(limit, 25)}&sort=-pubyear&field=dc:title,prism:publicationName,prism:coverDate,citedby-count,prism:doi,dc:identifier,dc:creator`;
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
  async findSimilarResearch(opts: {
    title: string;
    description?: string;
    projectText?: string;
    keywords?: string[];
    limit?: number;
  }) {
    const limit = opts.limit || 10;
    const cacheKey = `similar:${opts.title.substring(0, 40)}:${(opts.keywords || []).slice(0,2).join(',')}`;
    const cached = cache.get(cacheKey) as any;
    if (cached && cached.results) return cached;

    try {
      // Sorgu inşa stratejisi:
      // 1. Kullanıcının girdiği anahtar kelimeler varsa en güvenilir kaynak
      // 2. Başlıktan önemli kelimeleri çıkar
      // 3. Açıklama/proje metninden ek terimler

      const userKeywords = (opts.keywords || []).filter(k => k.length > 3);
      const titleWords = opts.title
        .split(/\s+/)
        .filter(w => w.length > 4 && !/^(ile|ve|veya|için|olan|ise|da|de|bu|bir|olarak|üzerine|üzerinde)$/i.test(w))
        .slice(0, 6);

      // Proje metninden önemli terimleri çıkar (büyük kelimeler / tekrar edenler)
      const textWords: string[] = [];
      const fullText = `${opts.description || ''} ${opts.projectText?.substring(0, 800) || ''}`;
      if (fullText.trim().length > 50) {
        const wordFreq: Record<string, number> = {};
        fullText.split(/\s+/).forEach(w => {
          const clean = w.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ]/g, '').toLowerCase();
          if (clean.length > 5) wordFreq[clean] = (wordFreq[clean] || 0) + 1;
        });
        Object.entries(wordFreq)
          .filter(([, count]) => count >= 2)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 4)
          .forEach(([word]) => textWords.push(word));
      }

      // Sorgu oluştur - en az 2 farklı yöntem dene, en iyisini seç
      let query = '';
      if (userKeywords.length >= 2) {
        // Kullanıcı anahtar kelimeleri - en güvenilir
        query = userKeywords.slice(0, 4).map(k => `KEY("${k}")`).join(' AND ');
      } else if (titleWords.length >= 3) {
        // Başlık kelimeleri
        query = `TITLE-ABS-KEY(${titleWords.slice(0, 4).join(' AND ')})`;
        if (userKeywords.length > 0) {
          query += ` AND KEY("${userKeywords[0]}")`;
        }
      } else if (textWords.length >= 2) {
        // Metin kelimeleri
        query = `TITLE-ABS-KEY(${textWords.slice(0, 3).join(' AND ')})`;
      } else {
        // Son çare - başlıktan kısa terimler
        query = `TITLE("${opts.title.substring(0, 70)}")`;
      }

      const url = `${this.BASE}/content/search/scopus?query=${encodeURIComponent(query)}&count=${Math.min(limit, 25)}&sort=-citedby-count&field=dc:title,prism:publicationName,prism:coverDate,citedby-count,prism:doi,dc:identifier,dc:creator`;
      const res = await fetch(url, { headers: this.headers(), signal: AbortSignal.timeout(20000) });
      if (!res.ok) return { total: 0, results: [], query };
      const data = await res.json();
      const total = +(data?.['search-results']?.['opensearch:totalResults'] || 0);

      const entries = data?.['search-results']?.['entry'] || [];
      const results = entries.map((e: any) => ({
        scopusId:    e['dc:identifier']?.replace('SCOPUS_ID:', '') || '',
        title:       e['dc:title'] || '',
        journal:     e['prism:publicationName'] || '',
        year:        e['prism:coverDate']?.substring(0, 4) || '',
        citedBy:     +(e['citedby-count'] || 0),
        doi:         e['prism:doi'] || '',
        firstAuthor: e['dc:creator'] || '',
      }));

      const out = { total, results, query };
      if (total > 0) cache.set(cacheKey, out, 43200);
      return out;
    } catch {
      return { total: 0, results: [] };
    }
  }

  // ── HİBE UYGUNLUK ANALİZİ ─────────────────────────────────────
  // Proje anahtar kelimelerine göre Scopus ASJC konu kodları bulunur,
  // bu kodlar aktif fon kaynaklarıyla eşleştirilir
  async getSubjectAreaMatch(keywords: string[], projectType?: string, title?: string) {
    const allTerms = [...keywords.filter(k => k.length > 2)];
    if (!allTerms.length && title) {
      title.split(/\s+/).filter(w => w.length > 4).slice(0, 5).forEach(w => allTerms.push(w));
    }
    if (!allTerms.length) return [];

    const cacheKey = `subject:${allTerms.slice(0, 4).join(',')}`;
    const cached = cache.get(cacheKey) as any[];
    if (cached) return cached;

    try {
      const query = allTerms.slice(0, 5).map(k => `KEY("${k}")`).join(' OR ');
      const url = `${this.BASE}/content/search/scopus?query=${encodeURIComponent(query)}&count=25&field=subject-areas`;
      const res = await fetch(url, { headers: this.headers(), signal: AbortSignal.timeout(15000) });
      if (!res.ok) return [];
      const data = await res.json();

      const areaCounts: Record<string, number> = {};
      (data?.['search-results']?.['entry'] || []).forEach((e: any) => {
        const areas = e['subject-areas']?.['subject-area'] || [];
        (Array.isArray(areas) ? areas : [areas]).forEach((a: any) => {
          const code = a?.['@abbrev'] || '';
          if (code) areaCounts[code] = (areaCounts[code] || 0) + 1;
        });
      });

      const sorted = Object.entries(areaCounts)
        .sort(([, a], [, b]) => b - a).slice(0, 5)
        .map(([code, count]) => ({ code, count, label: ASJC_LABELS[code] || code }));

      if (sorted.length > 0) cache.set(cacheKey, sorted, 86400);
      return sorted;
    } catch { return []; }
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
