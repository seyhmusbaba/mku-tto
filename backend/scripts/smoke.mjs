#!/usr/bin/env node
/**
 * Canlı ortam smoke test — kritik public endpoint'lerin 200 döndüğünü teyit eder.
 * Jest kurmadan basit pragmatic kontrol.
 *
 * KULLANIM:
 *   BASE_URL=https://mku-tto-production.up.railway.app/api node scripts/smoke.mjs
 */

const BASE = process.env.BASE_URL || 'http://localhost:3001/api';

const tests = [
  { name: 'Health',                    url: `${BASE}/health`,                            expect: (d) => d.status === 'healthy' || d.status === 'degraded' },
  { name: 'Integrations status',       url: `${BASE}/integrations/status`,               expect: (d) => typeof d.crossref === 'object' },
  { name: 'SCImago diagnostic',        url: `${BASE}/integrations/scimago/diagnostic`,   expect: (d) => 'loaded' in d },
  { name: 'CORDIS diagnostic',         url: `${BASE}/integrations/cordis/diagnostic`,    expect: (d) => 'hasData' in d },
];

let passed = 0;
let failed = 0;

for (const t of tests) {
  process.stdout.write(`• ${t.name.padEnd(30)} ... `);
  try {
    const res = await fetch(t.url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.log(`❌ HTTP ${res.status}`);
      failed++;
      continue;
    }
    const data = await res.json();
    if (!t.expect(data)) {
      console.log(`❌ Assertion failed`);
      failed++;
      continue;
    }
    console.log('✓');
    passed++;
  } catch (e) {
    console.log(`❌ ${e.message}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
