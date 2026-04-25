/**
 * Güvenilir yarışma/çağrı kaynakları - RSS dışı özel fetcher'lar.
 *
 * Desteklenen kaynak türleri:
 *  - tubitak    : TÜBİTAK duyurular (HTML scrape - tubitak.gov.tr/tr/duyuru)
 *  - kosgeb     : KOSGEB duyurular (HTML scrape - kosgeb.gov.tr)
 *  - eu-portal  : EU Funding & Tenders Portal (SEDIA JSON API)
 *  - rss        : Standart RSS/Atom feed (mevcut parser)
 *
 * Her fetcher FetchedItem[] döner - competitions.service bunları Competition
 * tablosuna dedupe-insert eder.
 */

export interface FetchedItem {
  title: string;
  description?: string;
  link: string;
  pubDate?: string;
  deadline?: string;
  category?: string;
  budget?: string;
  externalId: string;
}

export type FetcherType = 'tubitak' | 'kosgeb' | 'eu-portal' | 'rss';

/* ═════════════════════════════════════════════════════════
 * TÜBİTAK DUYURULAR
 * https://tubitak.gov.tr/tr/duyuru
 * ════════════════════════════════════════════════════════ */
export async function fetchTubitak(limit = 25): Promise<FetchedItem[]> {
  try {
    const res = await fetch('https://tubitak.gov.tr/tr/duyuru', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MKU-TTO/1.0)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Duyuru linklerini topla - `/tr/duyuru/<slug>` formatı
    const seenSlugs = new Set<string>();
    const items: FetchedItem[] = [];
    const linkRegex = /href="\/tr\/duyuru\/([a-z0-9-]+)"[^>]*>([^<]+)</gi;

    for (const m of html.matchAll(linkRegex)) {
      const slug = m[1];
      const title = m[2].trim();
      if (!title || title.length < 10) continue;
      if (seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);

      items.push({
        title,
        link: `https://tubitak.gov.tr/tr/duyuru/${slug}`,
        externalId: 'tubitak:' + slug,
        category: inferTubitakCategory(title),
      });
      if (items.length >= limit) break;
    }
    return items;
  } catch {
    return [];
  }
}

function inferTubitakCategory(title: string): string {
  const t = title.toLocaleLowerCase('tr-TR');
  if (/yarışma|yarisma|robot|tasarim|tasarım/.test(t)) return 'inovasyon';
  if (/ödül|odul|teşvik|tesvik|bilim/.test(t)) return 'araştırma';
  if (/girişim|girisim|start-?up/.test(t)) return 'girişim';
  if (/uluslararas|ikili işbirliği|erasmus|horizon|nrf|embo/.test(t)) return 'uluslararası';
  if (/çağrı|cagri|destek|hibe|proje/.test(t)) return 'araştırma';
  return 'araştırma';
}

/* ═════════════════════════════════════════════════════════
 * KOSGEB DUYURULAR
 * https://www.kosgeb.gov.tr/site/tr/genel/liste/2/duyurular
 * ════════════════════════════════════════════════════════ */
export async function fetchKosgeb(limit = 25): Promise<FetchedItem[]> {
  try {
    const res = await fetch('https://www.kosgeb.gov.tr/site/tr/genel/liste/2/duyurular', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MKU-TTO/1.0)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const html = await res.text();

    // KOSGEB detail URL formatı: /site/tr/genel/detay/<id>/<slug>
    const linkRegex = /href="(\/site\/tr\/genel\/detay\/(\d+)\/([a-z0-9-]+))"[^>]*>([^<]+)</gi;
    const seen = new Set<string>();
    const items: FetchedItem[] = [];

    for (const m of html.matchAll(linkRegex)) {
      const path = m[1];
      const id = m[2];
      const title = m[4].trim();
      if (!title || title.length < 10) continue;
      if (seen.has(id)) continue;
      seen.add(id);

      items.push({
        title,
        link: 'https://www.kosgeb.gov.tr' + path,
        externalId: 'kosgeb:' + id,
        category: 'girişim',
      });
      if (items.length >= limit) break;
    }
    return items;
  } catch {
    return [];
  }
}

/* ═════════════════════════════════════════════════════════
 * EU FUNDING & TENDERS PORTAL (SEDIA)
 * POST https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA
 *
 * Türkiye uygun AB çağrılarını filtrelemek için açık çağrı (status=31094501) tipindekileri getir.
 * ════════════════════════════════════════════════════════ */
export async function fetchEuFundingPortal(limit = 25): Promise<FetchedItem[]> {
  try {
    const body = {
      query: {
        bool: {
          must: [
            // Sadece açık çağrılar (forthcoming/open)
            { terms: { type: ['1', '2'] } },
            { terms: { status: ['31094501', '31094502'] } },
          ],
        },
      },
      languages: ['en'],
      sort: { field: 'sortStatus', order: 'ASC' },
    };

    const url = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=*&pageSize=' + limit + '&pageNumber=1';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; MKU-TTO/1.0)',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const results = data?.results || [];
    const items: FetchedItem[] = [];

    for (const r of results) {
      const id = r.reference || r.checksum;
      if (!id) continue;
      const metadata = r.metadata || {};
      const title = r.title || (metadata.title?.[0]) || r.summary;
      if (!title || title.length < 10) continue;

      // Son başvuru tarihi - metadata.deadlineDate veya callDeadlineDate
      let deadline: string | undefined;
      if (metadata.deadlineDate?.[0]) {
        deadline = String(metadata.deadlineDate[0]).split('T')[0];
      } else if (metadata.callDeadlineDate?.[0]) {
        deadline = String(metadata.callDeadlineDate[0]).split('T')[0];
      }

      // Topic URL - öncelikli
      const topicUrl = r.url || `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${r.reference}`;

      items.push({
        title: String(title).slice(0, 300),
        description: String(r.summary || r.content || '').slice(0, 500),
        link: topicUrl,
        externalId: 'eu:' + id,
        category: 'uluslararası',
        deadline,
      });
    }
    return items;
  } catch {
    return [];
  }
}
