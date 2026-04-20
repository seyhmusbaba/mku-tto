'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';

/**
 * Yıllık Kurumsal Bibliyometri Raporu — yazdırılabilir PDF.
 * Rektörlük, dekanlık, senato için dönem sonu kapak raporudur.
 */

const STATUS_LABELS: Record<string, string> = {
  application: 'Başvuru', pending: 'Beklemede', active: 'Aktif',
  completed: 'Tamamlandı', suspended: 'Askıda', cancelled: 'İptal',
};
const STATUS_COLORS: Record<string, string> = {
  application: '#d97706', pending: '#d97706', active: '#059669',
  completed: '#2563eb', suspended: '#6b7280', cancelled: '#dc2626',
};
const QUARTILE_COLORS: Record<string, string> = {
  Q1: '#059669', Q2: '#2563eb', Q3: '#d97706', Q4: '#dc2626', unknown: '#94a3b8',
};
const SDG_COLORS = ['#e5243b','#dda63a','#4c9f38','#c5192d','#ff3a21','#26bde2','#fcc30b','#a21942','#fd6925','#dd1367','#fd9d24','#bf8b2e','#3f7e44','#0a97d9','#56c02b','#00689d','#19486a'];
const SOURCE_LABELS: Record<string, string> = {
  crossref: 'Crossref', openalex: 'OpenAlex', wos: 'Web of Science',
  scopus: 'Scopus', pubmed: 'PubMed', arxiv: 'arXiv', semanticScholar: 'Semantic Scholar',
};

function formatTry(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
}
function formatNum(n: number) {
  return new Intl.NumberFormat('tr-TR').format(n || 0);
}

export default function AnnualReportPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<any>(null);
  const [radar, setRadar] = useState<any[]>([]);
  const [collab, setCollab] = useState<any>(null);
  const [sdgHeat, setSdgHeat] = useState<any>(null);
  const [researchers, setResearchers] = useState<any[]>([]);
  const [institutional, setInstitutional] = useState<any>(null);
  const [cordisProjects, setCordisProjects] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [funding, setFunding] = useState<any>(null);
  const [budget, setBudget] = useState<any>(null);
  const [siteName, setSiteName] = useState('MKÜ TTO');
  const year = new Date().getFullYear();

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    let token = '';
    try {
      token = sessionStorage.getItem('tto_print_token') || localStorage.getItem('tto_token') || '';
      sessionStorage.removeItem('tto_print_token');
    } catch {}
    if (!token) { setError('Oturum bulunamadı'); setLoading(false); return; }
    const headers = { Authorization: 'Bearer ' + token };

    Promise.all([
      axios.get(`${base}/analytics/overview`, { headers }).then(r => r.data).catch(() => null),
      axios.get(`${base}/analytics/institutional/faculty-radar`, { headers }).then(r => r.data).catch(() => []),
      axios.get(`${base}/analytics/institutional/collaboration-matrix`, { headers }).then(r => r.data).catch(() => null),
      axios.get(`${base}/analytics/institutional/sdg-heatmap`, { headers }).then(r => r.data).catch(() => null),
      axios.get(`${base}/analytics/researcher-productivity`, { headers, params: { limit: 25 } }).then(r => r.data).catch(() => []),
      axios.get(`${base}/analytics/bibliometrics/institutional`, { headers }).then(r => r.data).catch(() => null),
      axios.get(`${base}/integrations/cordis/organization`, { headers, params: { name: 'Mustafa Kemal University', limit: 20 } }).then(r => r.data).catch(() => []),
      axios.get(`${base}/analytics/timeline`, { headers }).then(r => r.data).catch(() => []),
      axios.get(`${base}/analytics/funding-success`, { headers }).then(r => r.data).catch(() => null),
      axios.get(`${base}/analytics/budget-utilization`, { headers }).then(r => r.data).catch(() => null),
      axios.get(`${base}/settings`, { headers }).then(r => { if (r.data?.site_name) setSiteName(r.data.site_name); }).catch(() => {}),
    ])
      .then(([ov, rad, col, sdg, res, inst, cord, tml, fnd, bud]) => {
        setOverview(ov); setRadar(rad); setCollab(col); setSdgHeat(sdg);
        setResearchers(res); setInstitutional(inst); setCordisProjects(cord || []);
        setTimeline(tml || []); setFunding(fnd); setBudget(bud);
      })
      .catch(() => setError('Rapor hazırlanırken hata oluştu'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading && !error) {
      const t = setTimeout(() => window.print(), 1000);
      return () => clearTimeout(t);
    }
  }, [loading, error]);

  if (loading) return <div style={s.center}><p style={s.muted}>Kurumsal rapor hazırlanıyor... (~20 saniye)</p></div>;
  if (error) return <div style={s.center}><p style={s.err}>{error}</p></div>;

  const facultyTotalSdg = sdgHeat?.cells?.length || 0;
  const sdgsCovered = new Set((sdgHeat?.cells || []).map((c: any) => c.sdgCode)).size;

  const quartileData = institutional ? [
    { name: 'Q1', value: institutional.quartileDistribution?.Q1 || 0 },
    { name: 'Q2', value: institutional.quartileDistribution?.Q2 || 0 },
    { name: 'Q3', value: institutional.quartileDistribution?.Q3 || 0 },
    { name: 'Q4', value: institutional.quartileDistribution?.Q4 || 0 },
    { name: 'Bilinmiyor', value: institutional.quartileDistribution?.unknown || 0 },
  ] : [];
  const quartileTotal = quartileData.reduce((x, q) => x + q.value, 0);

  // Yıllık büyüme hesabı
  const byYear: any[] = institutional?.byYear || [];
  const latestYears = byYear.slice(-5);
  const lastYear = byYear[byYear.length - 1];
  const prevYear = byYear[byYear.length - 2];
  const pubGrowthPct = lastYear && prevYear && prevYear.count > 0
    ? Math.round(((lastYear.count - prevYear.count) / prevYear.count) * 100)
    : null;

  // Kurumsal yayın listesi — en çok atıf alanlar
  const instPublications: any[] = institutional?.publications || [];
  const topCited = [...instPublications]
    .sort((a, b) => (b?.citedBy?.best || 0) - (a?.citedBy?.best || 0))
    .slice(0, 15);

  // Kurumsal yayın listesi — Q1 dergilerdeki yayınlar
  const q1Pubs = instPublications
    .filter(p => p?.quality?.sjrQuartile === 'Q1')
    .sort((a, b) => (b?.citedBy?.best || 0) - (a?.citedBy?.best || 0))
    .slice(0, 10);

  // Max bar scales
  const maxYearPub = Math.max(1, ...byYear.map(y => y.count || 0));
  const maxYearCit = Math.max(1, ...byYear.map(y => y.citations || 0));

  // Fakülte toplamları
  const totalFacultyProjects = radar.reduce((x, f: any) => x + (f.totalProjects || 0), 0);
  const totalIp = radar.reduce((x, f: any) => x + (f.ipCount || 0), 0);
  const totalMembers = radar.reduce((x, f: any) => x + (f.memberTotal || 0), 0);

  // Bütçe aralığı (sadece AB katkısı toplamı)
  const totalEuBudget = cordisProjects.reduce((x, p: any) => x + (Number(p.ecMaxContribution) || 0), 0);

  // SDG listesi (kurumsal bibliyometriden)
  const sdgDist: any[] = institutional?.sdgDistribution || [];

  return (
    <div style={s.page}>
      {/* Yazdırma kontrol bar */}
      <div className="no-print" style={s.toolbar}>
        <button onClick={() => window.print()} style={s.btnPrimary}>PDF olarak kaydet</button>
        <button onClick={() => window.close()} style={s.btnSecondary}>Kapat</button>
        <span style={s.tbHint}>Sayfa yüklenince otomatik print diyaloğu açılır</span>
      </div>

      {/* ═══ KAPAK ═══ */}
      <div style={{ ...s.section, ...s.coverPage }}>
        <div style={s.coverTop}>
          <p style={s.coverDate}>{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p style={s.coverInst}>{siteName}</p>
        </div>
        <div style={s.coverMid}>
          <h1 style={s.coverTitle}>YILLIK KURUMSAL<br/>BİBLİYOMETRİ RAPORU</h1>
          <p style={s.coverYear}>{year}</p>
          <p style={s.coverSubtitle}>
            Proje portföyü, araştırma çıktıları, kurumsal karşılaştırma ve
            sürdürülebilir kalkınma katkısının çok kaynaklı değerlendirmesi
          </p>
          <div style={s.coverFactBox}>
            <div><p style={s.coverFactNum}>{formatNum(overview?.total || 0)}</p><p style={s.coverFactLbl}>Proje</p></div>
            <div><p style={s.coverFactNum}>{formatNum(institutional?.total || 0)}</p><p style={s.coverFactLbl}>Yayın</p></div>
            <div><p style={s.coverFactNum}>{formatNum(institutional?.totalCitations || 0)}</p><p style={s.coverFactLbl}>Atıf</p></div>
            <div><p style={s.coverFactNum}>{sdgsCovered}/17</p><p style={s.coverFactLbl}>SDG</p></div>
          </div>
        </div>
        <div style={s.coverBottom}>
          <p style={s.coverDataSrc}>
            Veri kaynakları: Scopus · Web of Science · OpenAlex · Crossref ·
            SCImago · Unpaywall · PubMed · arXiv · Semantic Scholar · CORDIS · EPO OPS
          </p>
        </div>
      </div>

      {/* ═══ İÇİNDEKİLER ═══ */}
      <div style={s.section}>
        <h2 style={s.h2}>İÇİNDEKİLER</h2>
        <ol style={s.toc}>
          <li>Yönetici Özeti ve Ana Bulgular</li>
          <li>Proje Portföyü ve Durum Dağılımı</li>
          <li>Fakülte Performans Karşılaştırması</li>
          <li>Bibliyometrik Göstergeler ve Dergi Kalitesi</li>
          <li>Yıllara Göre Yayın ve Atıf Trendi</li>
          <li>En Çok Atıf Alan Yayınlar</li>
          <li>Q1 Dergi Yayınları</li>
          <li>Sürdürülebilir Kalkınma Hedeflerine Katkı</li>
          <li>Fakülteler Arası İşbirlikleri</li>
          <li>Uluslararası Fonlama (CORDIS)</li>
          <li>Bütçe Kullanımı ve Fonlama Başarısı</li>
          <li>Proje Zaman Çizelgesi</li>
          <li>En Üretken Araştırmacılar</li>
          <li>Ek: Metodoloji ve Veri Kaynakları</li>
        </ol>
      </div>

      {/* ═══ BÖLÜM 1: YÖNETİCİ ÖZETİ ═══ */}
      <div style={s.section}>
        <h2 style={s.h2}>1. YÖNETİCİ ÖZETİ VE ANA BULGULAR</h2>

        {/* Ana Bulgular paragrafı */}
        <div style={s.highlightBox}>
          <h3 style={s.highlightTitle}>Raporun Öne Çıkan Bulguları</h3>
          <ul style={s.highlightList}>
            <li>
              Toplamda <strong>{formatNum(overview?.total || 0)}</strong> proje izlenmekte olup,
              bunların <strong>{formatNum(overview?.activeProjects || 0)}</strong>'i aktif,
              <strong> {formatNum(overview?.completedProjects || 0)}</strong>'si tamamlanmıştır.
              Kararlaşan projeler üzerinde <strong>%{overview?.successRate || 0}</strong> başarı oranı
              elde edilmiştir.
            </li>
            <li>
              Kurumumuz OpenAlex havuzunda toplam <strong>{formatNum(institutional?.total || 0)}</strong> yayın
              ve <strong>{formatNum(institutional?.totalCitations || 0)}</strong> atıfa sahiptir.
              h-index <strong>{institutional?.hIndex || 0}</strong>, i10-index <strong>{institutional?.i10Index || 0}</strong>'dır.
            </li>
            {pubGrowthPct !== null && (
              <li>
                Yayın üretimi bir önceki yıla göre <strong style={{ color: pubGrowthPct >= 0 ? '#059669' : '#dc2626' }}>
                  {pubGrowthPct >= 0 ? '+' : ''}%{pubGrowthPct}
                </strong> değişim göstermiştir.
              </li>
            )}
            <li>
              Projeler <strong>{sdgsCovered}/17</strong> Sürdürülebilir Kalkınma Hedefi'ne değmektedir —
              toplam <strong>{facultyTotalSdg}</strong> fakülte-SDG eşlemesi tespit edilmiştir.
            </li>
            <li>
              Toplam bütçe <strong>{formatTry(overview?.totalBudget || 0)}</strong> olup
              proje başına ortalama <strong>{formatTry(overview?.avgBudget || 0)}</strong>'dir.
              {totalEuBudget > 0 && <> CORDIS kaynaklı AB fonlaması <strong>€{Number(totalEuBudget).toLocaleString('tr-TR')}</strong>'u bulmaktadır.</>}
            </li>
            <li>
              <strong>{formatNum(quartileData.find(q => q.name === 'Q1')?.value || 0)}</strong> yayın Q1 dergilerde yayınlanmıştır
              (toplamın %{quartileTotal > 0 ? Math.round(((quartileData.find(q => q.name === 'Q1')?.value || 0) / quartileTotal) * 100) : 0}'i).
              Açık erişim oranı <strong>%{institutional?.openAccessRatio || 0}</strong>'dir.
            </li>
          </ul>
        </div>

        {overview && (
          <>
            <h3 style={s.h3}>Ana Göstergeler</h3>
            <div style={s.kpiGrid}>
              <Kpi label="Toplam Proje" value={formatNum(overview.total || 0)} color="#1a3a6b" />
              <Kpi label="Aktif Proje" value={formatNum(overview.activeProjects || 0)} color="#059669" />
              <Kpi label="Tamamlanan" value={formatNum(overview.completedProjects || 0)} color="#2563eb" />
              <Kpi label="Toplam Bütçe" value={formatTry(overview.totalBudget || 0)} color="#c8a45a" />
              <Kpi label="Başarı Oranı" value={`%${overview.successRate || 0}`} color="#7c3aed" sub="kararlaşan" />
              <Kpi label="Ortalama Bütçe" value={formatTry(overview.avgBudget || 0)} color="#0891b2" />
            </div>
          </>
        )}

        {institutional && institutional.configured !== false && (
          <>
            <h3 style={s.h3}>Akademik Çıktı Göstergeleri</h3>
            <div style={s.kpiGrid}>
              <Kpi label="Toplam Yayın" value={formatNum(institutional.total || 0)} color="#1a3a6b" />
              <Kpi label="Toplam Atıf" value={formatNum(institutional.totalCitations || 0)} color="#7c3aed" />
              <Kpi label="h-index" value={institutional.hIndex || 0} color="#c8a45a" />
              <Kpi label="i10-index" value={institutional.i10Index || 0} color="#059669" />
              <Kpi label="Açık Erişim" value={`%${institutional.openAccessRatio || 0}`} sub={`${formatNum(institutional.openAccessCount || 0)} yayın`} color="#0891b2" />
              <Kpi label="Q1 Yayın" value={formatNum(institutional.quartileDistribution?.Q1 || 0)} color="#059669" sub={`%${quartileTotal > 0 ? Math.round(((institutional.quartileDistribution?.Q1 || 0) / quartileTotal) * 100) : 0} pay`} />
            </div>
          </>
        )}
      </div>

      {/* ═══ BÖLÜM 2: PROJE DURUMU ═══ */}
      {overview && (
        <div style={s.section}>
          <h2 style={s.h2}>2. PROJE PORTFÖYÜ VE DURUM DAĞILIMI</h2>
          <p style={s.p}>
            Proje portföyü, başvuru aşamasından iptal edilenlere kadar tüm durumlardaki kayıtları kapsamaktadır.
            Aktif proje sayısı kurumun mevcut araştırma kapasitesini, tamamlanan proje sayısı ise üretkenliği gösterir.
          </p>

          <h3 style={s.h3}>Durum Dağılımı</h3>
          {(overview.byStatus || []).filter((b: any) => b.count > 0).map((b: any) => {
            const pct = overview.total > 0 ? (b.count / overview.total) * 100 : 0;
            return (
              <div key={b.status} style={s.statusRow}>
                <span style={{ ...s.statusLabel, color: STATUS_COLORS[b.status] }}>{STATUS_LABELS[b.status] || b.status}</span>
                <div style={s.barTrack}>
                  <div style={{ ...s.barFill, width: `${pct}%`, background: STATUS_COLORS[b.status] }} />
                </div>
                <span style={s.statusCount}>{b.count}</span>
                <span style={s.statusPct}>%{Math.round(pct)}</span>
              </div>
            );
          })}

          {overview.byType && overview.byType.length > 0 && (
            <>
              <h3 style={s.h3}>Proje Türüne Göre Dağılım</h3>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Proje Türü</th>
                    <th style={s.thR}>Adet</th>
                    <th style={s.thR}>Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.byType.map((t: any) => (
                    <tr key={t.type}>
                      <td style={s.td}>{t.type}</td>
                      <td style={s.tdR}>{t.count}</td>
                      <td style={s.tdR}>%{overview.total > 0 ? Math.round((t.count / overview.total) * 100) : 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* ═══ BÖLÜM 3: FAKÜLTE KARŞILAŞTIRMASI ═══ */}
      {radar.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>3. FAKÜLTE PERFORMANS KARŞILAŞTIRMASI</h2>
          <p style={s.p}>
            Fakülteler 6 boyutta değerlendirildi: Proje Ölçeği, Bütçe, Başarı, SDG Kapsamı, Fikri Mülkiyet, Etik Uyum.
            Aşağıdaki tabloda her fakültenin tüm göstergeleri yan yana verilmiş; takip eden tabloda ise en yüksek başarı oranına
            sahip üç fakülte detaylandırılmıştır.
          </p>

          <h3 style={s.h3}>Tüm Fakülteler — Karşılaştırmalı Görünüm</h3>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Fakülte</th>
                <th style={s.thR}>Proje</th>
                <th style={s.thR}>Aktif</th>
                <th style={s.thR}>Tamam.</th>
                <th style={s.thR}>Başarı</th>
                <th style={s.thR}>Toplam Bütçe</th>
                <th style={s.thR}>SDG</th>
                <th style={s.thR}>IP</th>
                <th style={s.thR}>Etik</th>
                <th style={s.thR}>Üye</th>
              </tr>
            </thead>
            <tbody>
              {radar.map((f: any) => (
                <tr key={f.faculty}>
                  <td style={s.td}>{f.faculty}</td>
                  <td style={s.tdR}>{f.totalProjects}</td>
                  <td style={s.tdR}>{f.activeProjects}</td>
                  <td style={s.tdR}>{f.completedProjects}</td>
                  <td style={{ ...s.tdR, fontWeight: 700 }}>%{f.successRate}</td>
                  <td style={s.tdR}>{formatTry(f.totalBudget)}</td>
                  <td style={s.tdR}>{f.sdgCoverage}/17</td>
                  <td style={s.tdR}>{f.ipCount}</td>
                  <td style={s.tdR}>{f.ethicsApprovedCount}</td>
                  <td style={s.tdR}>{f.memberTotal}</td>
                </tr>
              ))}
              <tr style={{ background: '#f8f6f0', fontWeight: 700 }}>
                <td style={s.td}>TOPLAM</td>
                <td style={s.tdR}>{totalFacultyProjects}</td>
                <td style={s.tdR}>{radar.reduce((x, f: any) => x + (f.activeProjects || 0), 0)}</td>
                <td style={s.tdR}>{radar.reduce((x, f: any) => x + (f.completedProjects || 0), 0)}</td>
                <td style={s.tdR}>—</td>
                <td style={s.tdR}>{formatTry(radar.reduce((x, f: any) => x + (f.totalBudget || 0), 0))}</td>
                <td style={s.tdR}>{sdgsCovered}/17</td>
                <td style={s.tdR}>{totalIp}</td>
                <td style={s.tdR}>{radar.reduce((x, f: any) => x + (f.ethicsApprovedCount || 0), 0)}</td>
                <td style={s.tdR}>{totalMembers}</td>
              </tr>
            </tbody>
          </table>

          <h3 style={s.h3}>Başarı Oranında Öne Çıkan Fakülteler</h3>
          <div style={s.facultyCards}>
            {[...radar].sort((a: any, b: any) => b.successRate - a.successRate).slice(0, 3).map((f: any, i: number) => (
              <div key={f.faculty} style={s.facultyCard}>
                <p style={s.facultyRank}>#{i + 1}</p>
                <p style={s.facultyName}>{f.faculty}</p>
                <div style={s.facultyGrid}>
                  <div><p style={s.facultyVal}>%{f.successRate}</p><p style={s.facultyLbl}>Başarı</p></div>
                  <div><p style={s.facultyVal}>{f.completedProjects}</p><p style={s.facultyLbl}>Tamamlanan</p></div>
                  <div><p style={s.facultyVal}>{f.totalProjects}</p><p style={s.facultyLbl}>Toplam</p></div>
                  <div><p style={s.facultyVal}>{f.ipCount}</p><p style={s.facultyLbl}>IP</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ BÖLÜM 4: BİBLİYOMETRİK GÖSTERGELER ═══ */}
      {institutional && institutional.configured !== false && (
        <div style={s.section}>
          <h2 style={s.h2}>4. BİBLİYOMETRİK GÖSTERGELER VE DERGİ KALİTESİ</h2>
          <p style={s.p}>
            Kurumumuzun OpenAlex kaynağından çekilen yayın havuzu üzerinden hesaplanmıştır.
            SCImago Journal Rank (SJR) verisine göre dergi kuartilleri belirlenmiştir.
            Q1 kademesi yayın, derginin SJR sıralamasında ilk %25'te olduğunu gösterir.
          </p>

          {quartileTotal > 0 && (
            <>
              <h3 style={s.h3}>Dergi Kalite Dağılımı (SCImago SJR)</h3>
              {quartileData.map(q => {
                const key = q.name === 'Bilinmiyor' ? 'unknown' : q.name;
                const pct = quartileTotal > 0 ? (q.value / quartileTotal) * 100 : 0;
                return (
                  <div key={q.name} style={s.statusRow}>
                    <span style={{ ...s.statusLabel, color: QUARTILE_COLORS[key] || '#94a3b8' }}>{q.name}</span>
                    <div style={s.barTrack}>
                      <div style={{ ...s.barFill, width: `${pct}%`, background: QUARTILE_COLORS[key] || '#94a3b8' }} />
                    </div>
                    <span style={s.statusCount}>{q.value}</span>
                    <span style={s.statusPct}>%{Math.round(pct)}</span>
                  </div>
                );
              })}
              <p style={s.pSmall}>
                <em>Yorum: Q1 payı, yayınların prestijli dergilerde ne ölçüde yer aldığını gösterir.
                Q1+Q2 toplamı genelde başarılı bir akademik üretim seviyesinin göstergesidir.</em>
              </p>
            </>
          )}
        </div>
      )}

      {/* ═══ BÖLÜM 5: YILLIK TREND ═══ */}
      {byYear.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>5. YILLARA GÖRE YAYIN VE ATIF TRENDİ</h2>
          <p style={s.p}>
            {byYear[0]?.year}-{byYear[byYear.length - 1]?.year} aralığındaki yıllık yayın sayısı ve
            bu yayınların güncel toplam atıflarının dağılımı. Her yayın ilk yayımlandığı yılda sayılır;
            atıflar o yayının bugüne kadar aldığı toplamdır.
          </p>

          <h3 style={s.h3}>Yıllık Yayın Sayısı</h3>
          <div style={s.trendChart}>
            {byYear.map(y => {
              const h = maxYearPub > 0 ? (y.count / maxYearPub) * 100 : 0;
              return (
                <div key={y.year} style={s.trendBarCol}>
                  <div style={s.trendBarWrap}>
                    <span style={s.trendVal}>{y.count}</span>
                    <div style={{ ...s.trendBar, height: `${h}%`, background: '#1a3a6b' }} />
                  </div>
                  <p style={s.trendYear}>{y.year}</p>
                </div>
              );
            })}
          </div>

          <h3 style={s.h3}>Yıllık Atıf Birikimi</h3>
          <div style={s.trendChart}>
            {byYear.map(y => {
              const h = maxYearCit > 0 ? (y.citations / maxYearCit) * 100 : 0;
              return (
                <div key={y.year} style={s.trendBarCol}>
                  <div style={s.trendBarWrap}>
                    <span style={s.trendVal}>{y.citations}</span>
                    <div style={{ ...s.trendBar, height: `${h}%`, background: '#c8a45a' }} />
                  </div>
                  <p style={s.trendYear}>{y.year}</p>
                </div>
              );
            })}
          </div>

          {latestYears.length > 1 && (
            <>
              <h3 style={s.h3}>Son 5 Yılın Ayrıntısı</h3>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Yıl</th>
                    <th style={s.thR}>Yayın</th>
                    <th style={s.thR}>Atıf</th>
                    <th style={s.thR}>Yayın/Atıf Değişim</th>
                  </tr>
                </thead>
                <tbody>
                  {latestYears.map((y, i) => {
                    const prev = i > 0 ? latestYears[i - 1] : null;
                    const pubChange = prev && prev.count > 0 ? Math.round(((y.count - prev.count) / prev.count) * 100) : null;
                    return (
                      <tr key={y.year}>
                        <td style={s.td}>{y.year}</td>
                        <td style={s.tdR}>{y.count}</td>
                        <td style={s.tdR}>{y.citations}</td>
                        <td style={s.tdR}>
                          {pubChange === null ? '—' : <span style={{ color: pubChange >= 0 ? '#059669' : '#dc2626' }}>
                            {pubChange >= 0 ? '+' : ''}%{pubChange}
                          </span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* ═══ BÖLÜM 6: EN ÇOK ATIF ALAN YAYINLAR ═══ */}
      {topCited.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>6. EN ÇOK ATIF ALAN YAYINLAR (TOP {topCited.length})</h2>
          <p style={s.p}>
            Kurumumuzun bugüne kadarki en etkili çalışmaları — atıf sayısına göre sıralı.
            Her yayının yayımlandığı dergi ve Q kademesi ile birlikte listelendi.
          </p>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>#</th>
                <th style={s.th}>Başlık</th>
                <th style={s.th}>Dergi</th>
                <th style={s.thR}>Yıl</th>
                <th style={s.thR}>Q</th>
                <th style={s.thR}>Atıf</th>
              </tr>
            </thead>
            <tbody>
              {topCited.map((p, i) => (
                <tr key={p.doi || i}>
                  <td style={s.td}>{i + 1}</td>
                  <td style={s.tdSmall}>{p.title}</td>
                  <td style={s.tdSmall}>{p.journal || '—'}</td>
                  <td style={s.tdR}>{p.year || '—'}</td>
                  <td style={s.tdR}>
                    {p.quality?.sjrQuartile ? (
                      <span style={{ ...s.qBadge, background: QUARTILE_COLORS[p.quality.sjrQuartile] }}>
                        {p.quality.sjrQuartile}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ ...s.tdR, fontWeight: 700 }}>{p.citedBy?.best || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ BÖLÜM 7: Q1 DERGİ YAYINLARI ═══ */}
      {q1Pubs.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>7. Q1 DERGİ YAYINLARI (İLK 10)</h2>
          <p style={s.p}>
            SCImago SJR sıralamasında ilk %25'te yer alan dergilerde yayımlanan çalışmalar —
            kurumumuzun yüksek kaliteli yayın ürettiği alanları gösterir.
          </p>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>#</th>
                <th style={s.th}>Başlık</th>
                <th style={s.th}>Dergi</th>
                <th style={s.thR}>Yıl</th>
                <th style={s.thR}>Atıf</th>
                <th style={s.thR}>OA</th>
              </tr>
            </thead>
            <tbody>
              {q1Pubs.map((p, i) => (
                <tr key={p.doi || i}>
                  <td style={s.td}>{i + 1}</td>
                  <td style={s.tdSmall}>{p.title}</td>
                  <td style={s.tdSmall}>{p.journal || '—'}</td>
                  <td style={s.tdR}>{p.year || '—'}</td>
                  <td style={{ ...s.tdR, fontWeight: 700 }}>{p.citedBy?.best || 0}</td>
                  <td style={s.tdR}>{p.openAccess?.isOa ? 'Açık' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ BÖLÜM 8: SDG KATKISI ═══ */}
      {((sdgHeat && sdgHeat.sdgs?.length > 0) || sdgDist.length > 0) && (
        <div style={s.section}>
          <h2 style={s.h2}>8. SÜRDÜRÜLEBİLİR KALKINMA HEDEFLERİNE KATKI</h2>
          <p style={s.p}>
            BM'nin 17 SDG'sinden kurumumuz projeleri <strong>{sdgsCovered}/17</strong> hedefe değmektedir.
            Ek olarak OpenAlex yayın tabanlı analiz, araştırmaların hangi SDG'lere yönelik olduğunu tespit eder.
          </p>

          {sdgHeat?.sdgs?.length > 0 && (
            <>
              <h3 style={s.h3}>Proje Tabanlı SDG Dağılımı</h3>
              <div style={s.sdgGrid}>
                {sdgHeat.sdgs.map((sdg: string) => {
                  const num = parseInt(sdg.match(/\d+/)?.[0] || '0');
                  const color = SDG_COLORS[(num - 1) % SDG_COLORS.length];
                  const count = (sdgHeat.cells || []).filter((c: any) => c.sdgCode === sdg).reduce((x: number, c: any) => x + c.count, 0);
                  const facCount = (sdgHeat.cells || []).filter((c: any) => c.sdgCode === sdg).length;
                  return (
                    <div key={sdg} style={s.sdgItem}>
                      <div style={{ ...s.sdgNum, background: color }}>{num}</div>
                      <div style={s.sdgText}>
                        <p style={s.sdgCount}><strong>{count}</strong> proje</p>
                        <p style={s.sdgFac}>{facCount} fakülte</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {sdgDist.length > 0 && (
            <>
              <h3 style={s.h3}>Yayın Tabanlı SDG Katkısı (İlk 10)</h3>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>#</th>
                    <th style={s.th}>SDG</th>
                    <th style={s.thR}>Yayın</th>
                  </tr>
                </thead>
                <tbody>
                  {sdgDist.slice(0, 10).map((sd: any, i: number) => {
                    const num = parseInt(sd.id?.match(/\d+/)?.[0] || String(i + 1));
                    const color = SDG_COLORS[(num - 1) % SDG_COLORS.length];
                    return (
                      <tr key={sd.id}>
                        <td style={s.td}>
                          <span style={{ ...s.sdgNumSmall, background: color }}>{num}</span>
                        </td>
                        <td style={s.td}>{sd.name}</td>
                        <td style={{ ...s.tdR, fontWeight: 700 }}>{sd.count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* ═══ BÖLÜM 9: İŞBİRLİKLERİ ═══ */}
      {collab && collab.cells?.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>9. FAKÜLTELER ARASI İŞBİRLİKLERİ</h2>
          <p style={s.p}>
            Aynı projede farklı fakültelerden üyeler — kurum içi disiplinlerarası işbirliğinin
            en doğrudan göstergesi. Listede paylaşılan proje sayısı en yüksek ilk 20 çift
            gösterilmiştir.
          </p>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>#</th>
                <th style={s.th}>Fakülte A</th>
                <th style={s.th}>Fakülte B</th>
                <th style={s.thR}>Ortak Proje</th>
              </tr>
            </thead>
            <tbody>
              {collab.cells.slice(0, 20).map((c: any, i: number) => (
                <tr key={i}>
                  <td style={s.td}>{i + 1}</td>
                  <td style={s.td}>{c.facultyA}</td>
                  <td style={s.td}>{c.facultyB}</td>
                  <td style={{ ...s.tdR, fontWeight: 700 }}>{c.sharedProjects}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ BÖLÜM 10: AB PROJELERİ ═══ */}
      {cordisProjects.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>10. ULUSLARARASI FONLAMA (CORDIS — AB)</h2>
          <p style={s.p}>
            Kurumumuzun katıldığı AB araştırma projeleri — Horizon Europe, Horizon 2020, FP7 programları.
            Toplam AB katkısı: <strong>€{Number(totalEuBudget).toLocaleString('tr-TR')}</strong>.
          </p>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Program</th>
                <th style={s.th}>Akronim</th>
                <th style={s.th}>Başlık</th>
                <th style={s.th}>Koordinatör</th>
                <th style={s.thR}>AB Katkısı</th>
              </tr>
            </thead>
            <tbody>
              {cordisProjects.slice(0, 15).map((p: any) => (
                <tr key={p.id}>
                  <td style={s.td}>{p.framework}</td>
                  <td style={s.td}>{p.acronym || '—'}</td>
                  <td style={s.tdSmall}>{p.title}</td>
                  <td style={s.td}>{p.coordinator?.name || '—'}</td>
                  <td style={s.tdR}>{p.ecMaxContribution ? '€' + Number(p.ecMaxContribution).toLocaleString('tr-TR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ BÖLÜM 11: BÜTÇE VE FONLAMA ═══ */}
      {(funding || budget) && (
        <div style={s.section}>
          <h2 style={s.h2}>11. BÜTÇE KULLANIMI VE FONLAMA BAŞARISI</h2>
          <p style={s.p}>
            Projelerin bütçe tüketim oranları ile fonlama kaynaklarına göre başarı oranları.
            Yüksek tüketim oranı aktif yürütmeyi, yüksek başarı oranı o kaynağın verimini gösterir.
          </p>

          {budget?.byProject && budget.byProject.length > 0 && (
            <>
              <h3 style={s.h3}>En Yüksek Bütçeli Aktif 10 Proje</h3>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Proje</th>
                    <th style={s.thR}>Bütçe</th>
                    <th style={s.thR}>Harcanan</th>
                    <th style={s.thR}>Kullanım</th>
                  </tr>
                </thead>
                <tbody>
                  {budget.byProject.slice(0, 10).map((p: any) => (
                    <tr key={p.id}>
                      <td style={s.tdSmall}>{p.name || p.title}</td>
                      <td style={s.tdR}>{formatTry(p.budget || 0)}</td>
                      <td style={s.tdR}>{formatTry(p.spent || 0)}</td>
                      <td style={{ ...s.tdR, fontWeight: 700 }}>%{p.utilizationPct || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {funding?.bySource && funding.bySource.length > 0 && (
            <>
              <h3 style={s.h3}>Fonlama Kaynağına Göre Başarı</h3>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Kaynak</th>
                    <th style={s.thR}>Başvuru</th>
                    <th style={s.thR}>Kabul</th>
                    <th style={s.thR}>Başarı Oranı</th>
                    <th style={s.thR}>Toplam Bütçe</th>
                  </tr>
                </thead>
                <tbody>
                  {funding.bySource.map((f: any) => (
                    <tr key={f.source}>
                      <td style={s.td}>{f.source || '—'}</td>
                      <td style={s.tdR}>{f.totalApplications || 0}</td>
                      <td style={s.tdR}>{f.accepted || 0}</td>
                      <td style={{ ...s.tdR, fontWeight: 700 }}>%{f.successRate || 0}</td>
                      <td style={s.tdR}>{formatTry(f.totalBudget || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* ═══ BÖLÜM 12: ZAMAN ÇİZELGESİ ═══ */}
      {timeline.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>12. PROJE ZAMAN ÇİZELGESİ</h2>
          <p style={s.p}>
            Son yıllarda başlatılan ve tamamlanan proje hacminin aylık/yıllık seyri.
          </p>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Dönem</th>
                <th style={s.thR}>Başlatılan</th>
                <th style={s.thR}>Tamamlanan</th>
                <th style={s.thR}>İptal</th>
              </tr>
            </thead>
            <tbody>
              {timeline.slice(-24).map((t: any) => (
                <tr key={t.period}>
                  <td style={s.td}>{t.period}</td>
                  <td style={s.tdR}>{t.started || 0}</td>
                  <td style={s.tdR}>{t.completed || 0}</td>
                  <td style={s.tdR}>{t.cancelled || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ BÖLÜM 13: EN ÜRETKEN ARAŞTIRMACILAR ═══ */}
      {researchers.length > 0 && (
        <div style={s.section}>
          <h2 style={s.h2}>13. EN ÜRETKEN ARAŞTIRMACILAR</h2>
          <p style={s.p}>
            Proje sayısı ve tamamlanan proje oranına göre ilk {researchers.length} araştırmacı.
            Her isim, yürüttüğü araştırma programının ölçeğini gösterir.
          </p>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>#</th>
                <th style={s.th}>Araştırmacı</th>
                <th style={s.th}>Fakülte</th>
                <th style={s.th}>Bölüm</th>
                <th style={s.thR}>Toplam</th>
                <th style={s.thR}>Aktif</th>
                <th style={s.thR}>Tamam.</th>
                <th style={s.thR}>Bütçe</th>
              </tr>
            </thead>
            <tbody>
              {researchers.map((r: any, i: number) => (
                <tr key={r.userId}>
                  <td style={s.td}>{i + 1}</td>
                  <td style={{ ...s.td, fontWeight: i < 3 ? 700 : 400 }}>{r.name}</td>
                  <td style={s.td}>{r.faculty || '—'}</td>
                  <td style={s.td}>{r.department || '—'}</td>
                  <td style={s.tdR}>{r.total}</td>
                  <td style={s.tdR}>{r.active}</td>
                  <td style={s.tdR}>{r.completed}</td>
                  <td style={s.tdR}>{formatTry(r.totalBudget)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ METODOLOJİ ═══ */}
      <div style={s.section}>
        <h2 style={s.h2}>EK: METODOLOJİ VE VERİ KAYNAKLARI</h2>
        <p style={s.p}>
          <strong>Veri birleştirme:</strong> Yayınlar DOI bazlı dedupe ile her kaynaktan bir kez sayılır.
          Atıf sayısında kaynaklar arasında en yüksek değer baz alınır. Böylece aynı makalenin iki farklı
          veritabanındaki kaydı iki kere sayılmaz.
        </p>
        <p style={s.p}>
          <strong>Başarı oranı:</strong> Sadece karara bağlanmış projeler (tamamlanan + iptal edilen)
          üzerinden hesaplanır. Devam eden projeler oranı bozmaz — böylece oran anlık yürütmeden bağımsız
          olarak tutarlı bir kurumsal göstergeye dönüşür.
        </p>
        <p style={s.p}>
          <strong>Normalize değerler:</strong> Fakülte radar'ındaki 0-100 skorları, en yüksek değere sahip
          fakülteye göre göreceli olarak ölçeklenir. Mutlak büyüklük bilinmek isteniyorsa Bölüm 3'teki
          ham sayılar incelenmelidir.
        </p>
        <p style={s.p}>
          <strong>SDG eşleştirmesi:</strong> İki yoldan gelir: (a) projeye sahibi tarafından atanan SDG'ler,
          (b) OpenAlex'in yayın bazlı otomatik SDG tahminleri. İkinci yöntem 0.3 üstü olasılık skoruna sahip
          eşleşmeleri kapsar.
        </p>
        <p style={s.p}>
          <strong>Dergi kalitesi:</strong> SCImago Journal Rank en güncel veri seti kullanılır. Q1-Q4
          kuartilleri ilgili dergi için "Best Quartile" alanından alınır. OpenAlex venue API'sinden gelen
          2 yıl ortalama atıf da yedek olarak kullanılır.
        </p>
        <p style={s.p}>
          <strong>Kurumsal yayın havuzu:</strong> OpenAlex institution ID üzerinden çekilir.
          Şuan MKÜ için maksimum 500 yayın pencerelenmiştir. Yayın ORCID eşleşmesi olan araştırmacılar
          için daha derin bir tarama araştırmacı profilinden ayrı olarak yapılır.
        </p>
        <p style={s.p}>
          <strong>Uluslararası fonlama:</strong> OpenAIRE (CORDIS) açık veri API'si kullanılır.
          "Mustafa Kemal University" eşleşmesi yapan projelerin listesi çekilir.
        </p>

        <div style={s.footerMeta}>
          <p>Rapor üretici: {siteName} · Yıl {year}</p>
          <p>Oluşturulma: {new Date().toLocaleString('tr-TR')}</p>
          <p>Bu rapor otomatik olarak üretilmiştir. Veri kaynakları sürekli güncellendiği için
             farklı tarihlerde üretilen raporlar arasında küçük farklar olabilir.</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Yardımcı bileşen ─── */
function Kpi({ label, value, sub, color }: { label: string; value: any; sub?: string; color: string }) {
  return (
    <div style={{ ...s.kpi, borderColor: color + '44' }}>
      <p style={{ ...s.kpiValue, color }}>{value}</p>
      <p style={s.kpiLabel}>{label}</p>
      {sub && <p style={s.kpiSub}>{sub}</p>}
    </div>
  );
}

/* ─── Stiller ─── */
const s: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: '210mm',
    margin: '0 auto',
    padding: '14mm',
    background: 'white',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1f2937',
    fontSize: 11,
    lineHeight: 1.45,
  },
  center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' },
  muted: { color: '#6b7280' },
  err: { color: '#dc2626' },

  toolbar: {
    position: 'sticky', top: 0, background: '#0f2444', padding: '10px 14mm', margin: '-14mm -14mm 16px',
    display: 'flex', alignItems: 'center', gap: 10, zIndex: 10,
  },
  btnPrimary: { background: '#c8a45a', color: '#0f2444', padding: '8px 16px', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 12 },
  btnSecondary: { background: 'white', color: '#0f2444', padding: '8px 16px', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 12 },
  tbHint: { color: 'white', fontSize: 11, opacity: 0.7 },

  section: { marginBottom: 22, pageBreakInside: 'avoid' },
  coverPage: {
    minHeight: '260mm', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    background: 'linear-gradient(135deg, #0f2444 0%, #1a3a6b 100%)',
    color: 'white', padding: '24mm',
    margin: '-14mm -14mm 22px',
    pageBreakAfter: 'always',
  },
  coverTop: { display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.8 },
  coverDate: { margin: 0 },
  coverInst: { margin: 0, fontWeight: 700 },
  coverMid: { textAlign: 'center' },
  coverTitle: { fontSize: 36, fontWeight: 700, margin: 0, lineHeight: 1.15, letterSpacing: 1 },
  coverYear: { fontSize: 64, fontWeight: 700, color: '#c8a45a', margin: '30px 0 10px' },
  coverSubtitle: { fontSize: 13, margin: '10px auto 0', maxWidth: 500, opacity: 0.85, lineHeight: 1.6 },
  coverFactBox: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, maxWidth: 500, margin: '36px auto 0' },
  coverFactNum: { fontSize: 28, fontWeight: 700, color: '#c8a45a', margin: 0, lineHeight: 1 },
  coverFactLbl: { fontSize: 11, margin: '4px 0 0', opacity: 0.7, textTransform: 'uppercase' as const, letterSpacing: 1 },
  coverBottom: { fontSize: 9, opacity: 0.6, textAlign: 'center' },
  coverDataSrc: { margin: 0 },

  h2: { fontSize: 14, fontWeight: 700, color: '#0f2444', margin: '0 0 6px', paddingBottom: 6, borderBottom: '2px solid #0f2444' },
  h3: { fontSize: 12, fontWeight: 700, color: '#374151', margin: '14px 0 6px' },
  p: { fontSize: 11, margin: '0 0 10px', color: '#4b5563' },
  pSmall: { fontSize: 10, margin: '6px 0 0', color: '#6b7280' },

  toc: { fontSize: 11, lineHeight: 1.9, color: '#374151', paddingLeft: 20 },

  highlightBox: { background: '#faf8f4', border: '1px solid #e8e4dc', borderLeft: '4px solid #c8a45a', padding: 12, borderRadius: 4, marginBottom: 14 },
  highlightTitle: { fontSize: 12, fontWeight: 700, color: '#0f2444', margin: '0 0 8px' },
  highlightList: { fontSize: 11, margin: 0, paddingLeft: 18, lineHeight: 1.7, color: '#374151' },

  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 },
  kpi: { padding: 10, border: '1.5px solid', borderRadius: 8, textAlign: 'center' },
  kpiValue: { fontSize: 18, fontWeight: 700, margin: 0, lineHeight: 1 },
  kpiLabel: { fontSize: 9, color: '#6b7280', margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiSub: { fontSize: 9, fontWeight: 600, margin: 0, color: '#6b7280' },

  statusRow: { display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' },
  statusLabel: { width: 100, fontSize: 11, fontWeight: 600 },
  barTrack: { flex: 1, height: 14, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  statusCount: { width: 40, textAlign: 'right', fontSize: 11, fontWeight: 700 },
  statusPct: { width: 40, textAlign: 'right', fontSize: 10, color: '#6b7280' },

  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 10 },
  th: { textAlign: 'left' as const, padding: '6px 8px', background: '#faf8f4', borderBottom: '1px solid #e8e4dc', fontWeight: 700, color: '#374151' },
  thR: { textAlign: 'right' as const, padding: '6px 8px', background: '#faf8f4', borderBottom: '1px solid #e8e4dc', fontWeight: 700, color: '#374151' },
  td: { padding: '5px 8px', borderBottom: '1px solid #f0ede8' },
  tdR: { padding: '5px 8px', borderBottom: '1px solid #f0ede8', textAlign: 'right' as const },
  tdSmall: { padding: '5px 8px', borderBottom: '1px solid #f0ede8', fontSize: 9, maxWidth: 300 },

  qBadge: { color: 'white', padding: '2px 6px', borderRadius: 3, fontSize: 9, fontWeight: 700 },

  sdgGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 },
  sdgItem: { display: 'flex', alignItems: 'center', gap: 6, padding: 6, background: '#f9fafb', borderRadius: 4 },
  sdgNum: { width: 26, height: 26, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 12, flexShrink: 0 },
  sdgNumSmall: { width: 22, height: 22, borderRadius: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 11 },
  sdgText: { fontSize: 9 },
  sdgCount: { margin: 0, color: '#0f2444', fontSize: 10 },
  sdgFac: { margin: 0, color: '#6b7280', fontSize: 9 },

  facultyCards: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 },
  facultyCard: { padding: 10, border: '1px solid #e8e4dc', borderRadius: 6, background: '#faf8f4' },
  facultyRank: { fontSize: 20, fontWeight: 700, color: '#c8a45a', margin: 0 },
  facultyName: { fontSize: 11, fontWeight: 700, color: '#0f2444', margin: '2px 0 8px' },
  facultyGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 },
  facultyVal: { fontSize: 14, fontWeight: 700, color: '#1a3a6b', margin: 0 },
  facultyLbl: { fontSize: 8, color: '#6b7280', margin: 0, textTransform: 'uppercase' as const, letterSpacing: 0.3 },

  trendChart: { display: 'flex', alignItems: 'flex-end', gap: 3, height: 120, padding: '8px 0', background: 'linear-gradient(to top, #f9fafb 0%, transparent 100%)', borderBottom: '1px solid #e8e4dc', marginBottom: 4 },
  trendBarCol: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2 },
  trendBarWrap: { flex: 1, width: '100%', display: 'flex', flexDirection: 'column' as const, justifyContent: 'flex-end', alignItems: 'center', position: 'relative' as const, minHeight: 80 },
  trendBar: { width: '80%', minHeight: 2, borderRadius: '2px 2px 0 0' },
  trendVal: { fontSize: 8, color: '#374151', fontWeight: 600, position: 'absolute' as const, top: 0 },
  trendYear: { fontSize: 9, color: '#6b7280', margin: 0 },

  footerMeta: { marginTop: 14, paddingTop: 8, borderTop: '1px solid #e5e7eb', fontSize: 9, color: '#9ca3af', textAlign: 'center' as const },
};
