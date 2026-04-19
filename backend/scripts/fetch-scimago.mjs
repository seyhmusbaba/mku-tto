#!/usr/bin/env node
/**
 * SCImago Journal Rank CSV'sini yerel makinenize indirir ve
 * backend/assets/scimago-sjr.csv altına yerleştirir. Sonra git ile commit
 * edip push edin → Railway repo'dan dosya sisteminden okur.
 *
 * NEDEN BU ŞEKİLDE?
 * SCImago, Railway/Render/Fly gibi datacenter IP'lerine 403 dönüyor
 * (Cloudflare bloğu). Yerel bilgisayarınız (residential IP) problemsiz
 * indirir.
 *
 * KULLANIM:
 *   cd backend
 *   node scripts/fetch-scimago.mjs
 *
 * Tipik süre: 30-60 sn, dosya boyutu ~30 MB (sadece ihtiyaç duyulan kolonlar).
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = join(__dirname, '..', 'assets');
const OUT_PATH  = join(OUT_DIR, 'scimago-sjr.csv');

const CANDIDATES = [
  'https://www.scimagojr.com/journalrank.php?out=xls',
  'https://www.scimagojr.com/journalrank.php?out=xls&year=2024',
  'https://www.scimagojr.com/journalrank.php?out=xls&year=2023',
];

async function main() {
  console.log('SCImago Journal Rank CSV indiriliyor...');
  console.log(`Hedef: ${OUT_PATH}`);

  let ok = false;
  for (const url of CANDIDATES) {
    console.log(`\n→ Deniyor: ${url}`);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; mku-tto fetcher)',
          'Accept': 'text/csv, application/csv, text/plain, */*',
        },
      });
      console.log(`  HTTP ${res.status} ${res.statusText}`);
      console.log(`  Content-Type: ${res.headers.get('content-type')}`);

      if (!res.ok) continue;

      const text = await res.text();
      if (!/rank|issn|title/i.test(text.slice(0, 200))) {
        console.log('  Uyarı: içerik beklenen formatta değil (ilk 200 karakter):');
        console.log('  ' + text.slice(0, 200));
        continue;
      }

      // Boyut ve kayıt sayısı raporu
      const lines = text.split(/\r?\n/).filter(Boolean);
      console.log(`  Başarılı: ${(text.length / 1024 / 1024).toFixed(1)} MB, ~${lines.length} satır`);

      // Orijinal CSV'yi trimle — sadece bibliyometri için gerekli kolonlar
      const trimmed = trimCsv(text);
      console.log(`  Trimlenmiş boyut: ${(trimmed.length / 1024 / 1024).toFixed(1)} MB`);

      if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(OUT_PATH, trimmed, 'utf-8');
      console.log(`\n✓ Kaydedildi: ${OUT_PATH}`);
      console.log('\nŞimdi commit + push edin:');
      console.log('  git add backend/assets/scimago-sjr.csv');
      console.log('  git commit -m "data: SCImago SJR snapshot"');
      console.log('  git push');
      ok = true;
      break;
    } catch (e) {
      console.log(`  Hata: ${e.message}`);
    }
  }

  if (!ok) {
    console.error('\n✗ Hiçbir URL\'den indirilemedi. SCImago erişim sorunu olabilir.');
    process.exit(1);
  }
}

/**
 * SCImago CSV'sinden sadece lazım olan kolonları tut.
 * Tam dosya ~150 MB; trimlenmiş ~30 MB.
 * Tutulan kolonlar: Rank, Title, Type, Issn, SJR, SJR Best Quartile,
 *                   H index, Country, Publisher, Categories
 */
function trimCsv(text) {
  // BOM at
  text = text.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return text;

  const headers = lines[0].split(';').map(h => h.replace(/"/g, '').trim());
  const keepCols = [
    'Rank', 'Title', 'Type', 'Issn', 'SJR', 'SJR Best Quartile',
    'H index', 'Country', 'Publisher', 'Categories',
  ];
  const indices = keepCols.map(c => headers.findIndex(h => h.toLowerCase() === c.toLowerCase()))
    .filter(i => i >= 0);
  if (indices.length === 0) {
    console.log('  Uyarı: başlık eşleşmesi yapılamadı, orijinal CSV kullanılıyor');
    return text;
  }

  const trimmedHeader = indices.map(i => headers[i]).join(';');
  const out = [trimmedHeader];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const cols = lines[i].split(';');
    out.push(indices.map(idx => cols[idx] ?? '').join(';'));
  }
  return '\uFEFF' + out.join('\r\n');
}

main().catch(e => {
  console.error('Beklenmeyen hata:', e);
  process.exit(1);
});
