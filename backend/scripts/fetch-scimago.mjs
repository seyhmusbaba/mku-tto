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

import { writeFileSync, mkdirSync, existsSync, readFileSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

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
      // Cloudflare bot bloğunu geçmek için tam Chrome browser fingerprint
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Referer': 'https://www.scimagojr.com/journalrank.php',
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

      // Orijinal CSV'yi trimle - sadece bibliyometri için gerekli kolonlar
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
    console.log('\n⚠ Node fetch başarısız - Cloudflare TLS fingerprint kontrolü.');
    console.log('  curl ile fallback deneniyor (curl çoğu sistemde varsayılan)...');
    if (await tryCurlFallback()) {
      ok = true;
    } else {
      console.error('\n✗ curl ile de indirilemedi.');
      console.error('  Çözüm önerileri:');
      console.error('  1. Tarayıcıda https://www.scimagojr.com/journalrank.php aç,');
      console.error('     "Download data" linkine tıkla, indirilen dosyayı:');
      console.error('     ' + OUT_PATH);
      console.error('     yoluna kaydet.');
      console.error('  2. Sonra: git add backend/assets/scimago-sjr.csv && git commit && git push');
      process.exit(1);
    }
  }
}

async function tryCurlFallback() {
  for (const url of CANDIDATES) {
    console.log(`\n→ curl deneniyor: ${url}`);
    const tmpFile = join(tmpdir(), `scimago-${Date.now()}.csv`);
    try {
      execSync([
        'curl', '-sS', '-L', '-f',
        '-o', `"${tmpFile}"`,
        '-H', '"User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"',
        '-H', '"Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"',
        '-H', '"Accept-Language: tr-TR,tr;q=0.9,en;q=0.8"',
        '-H', '"Referer: https://www.scimagojr.com/journalrank.php"',
        `"${url}"`,
      ].join(' '), { stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000 });

      if (!existsSync(tmpFile)) continue;
      const text = readFileSync(tmpFile, 'utf-8');
      unlinkSync(tmpFile);
      if (!/rank|issn|title/i.test(text.slice(0, 200))) {
        console.log('  Beklenmeyen içerik formatı.');
        continue;
      }
      const lines = text.split(/\r?\n/).filter(Boolean);
      console.log(`  ✓ curl ile indirildi: ${(text.length / 1024 / 1024).toFixed(1)} MB, ~${lines.length} satır`);
      const trimmed = trimCsv(text);
      if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(OUT_PATH, trimmed, 'utf-8');
      console.log(`✓ Kaydedildi: ${OUT_PATH} (${(trimmed.length / 1024 / 1024).toFixed(1)} MB)`);
      console.log('\nŞimdi commit + push edin:');
      console.log('  git add backend/assets/scimago-sjr.csv');
      console.log('  git commit -m "data: SCImago SJR snapshot"');
      console.log('  git push');
      return true;
    } catch (e) {
      console.log(`  curl hata: ${e.message}`);
    }
  }
  return false;
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
