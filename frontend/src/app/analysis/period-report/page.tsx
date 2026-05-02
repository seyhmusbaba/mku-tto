'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';

/**
 * Dönemsel Rapor - belirli tarih aralığı için özet PDF.
 * /analysis sayfasından "Dönemsel Rapor" modal'ından açılır.
 *
 * Query params: from=YYYY-MM-DD, to=YYYY-MM-DD, preset=30d|90d|qtr|ytd|1y|custom
 * Veri: overview (tarih aralığı filtreli), timeline, faculty-radar
 */

const STATUS_LABELS: Record<string, string> = {
  application: 'Başvuru', pending: 'Beklemede', active: 'Aktif',
  completed: 'Tamamlandı', suspended: 'Askıda', cancelled: 'İptal',
};
const STATUS_COLORS: Record<string, string> = {
  application: '#d97706', pending: '#d97706', active: '#059669',
  completed: '#2563eb', suspended: '#6b7280', cancelled: '#dc2626',
};

const PRESET_LABELS: Record<string, string> = {
  '7d': 'Son 7 Gün', '30d': 'Son 30 Gün', '90d': 'Son 90 Gün',
  'qtr': 'Bu Çeyrek', 'ytd': 'Yıl Başından Bugüne',
  '1y': 'Son 1 Yıl', 'custom': 'Özel Aralık',
};

function formatTry(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n || 0);
}
function formatNum(n: number) {
  return new Intl.NumberFormat('tr-TR').format(n || 0);
}
function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return d; }
}

function PeriodReportContent() {
  const params = useSearchParams();
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const preset = params.get('preset') || 'custom';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<any>(null);
  const [radar, setRadar] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [researchers, setResearchers] = useState<any[]>([]);
  const [institutional, setInstitutional] = useState<any>(null);
  const [cordisProjects, setCordisProjects] = useState<any[]>([]);
  const [funding, setFunding] = useState<any>(null);
  const [institutionName, setInstitutionName] = useState('Hatay Mustafa Kemal Üniversitesi');
  const [rectorName, setRectorName] = useState('Prof. Dr. Veysel EREN');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<{ name: string; role?: string } | null>(null);
  // Admin ayarindan bibliyometri durumu - kapaliysa hicbir bibliyometri bolumu gosterilmez
  const [bibliometricsEnabled, setBibliometricsEnabled] = useState<boolean>(true);

  const days = from && to ? Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000) : 0;

  useEffect(() => {
    if (!from || !to) { setError('Tarih aralığı geçersiz'); setLoading(false); return; }
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    let token = '';
    try {
      token = sessionStorage.getItem('tto_print_token') || localStorage.getItem('tto_token') || '';
      sessionStorage.removeItem('tto_print_token');
    } catch {}
    if (!token) { setError('Oturum bulunamadı'); setLoading(false); return; }
    const headers = { Authorization: 'Bearer ' + token };

    // Once ayarlari cek - bibliyometri AÇIK mı?
    axios.get(`${base}/settings`, { headers })
      .then(r => {
        if (r.data?.institution_name) setInstitutionName(r.data.institution_name);
        if (r.data?.rector_name) setRectorName(r.data.rector_name);
        if (r.data?.logo_url) setLogoUrl(r.data.logo_url);
        const showBib = r.data?.show_bibliometrics;
        const enabled = !(showBib === 'false' || showBib === false);
        setBibliometricsEnabled(enabled);
        return enabled;
      })
      .catch(() => true)
      .then((enabled) => {
        const projectCalls = [
          axios.get(`${base}/analytics/overview`, { headers, params: { from, to } }).then(r => r.data).catch(() => null),
          axios.get(`${base}/analytics/institutional/faculty-radar`, { headers }).then(r => r.data).catch(() => []),
          axios.get(`${base}/analytics/timeline`, { headers }).then(r => r.data).catch(() => []),
          axios.get(`${base}/analytics/researcher-productivity`, { headers, params: { limit: 20 } }).then(r => r.data).catch(() => []),
          axios.get(`${base}/integrations/cordis/organization`, { headers, params: { name: 'Mustafa Kemal University', limit: 15 } }).then(r => r.data).catch(() => []),
          axios.get(`${base}/analytics/funding-success`, { headers }).then(r => r.data).catch(() => null),
        ];
        // Bibliyometri yalnizca acikken cagrilir
        const bibCall = enabled
          ? axios.get(`${base}/analytics/bibliometrics/institutional`, {
              headers,
              params: {
                fromYear: from ? new Date(from).getFullYear() : undefined,
                toYear: to ? new Date(to).getFullYear() : undefined,
              },
            }).then(r => r.data).catch(() => null)
          : Promise.resolve(null);

        // Kullanici bilgisi paralel
        axios.get(`${base}/users/me`, { headers }).then(r => {
          const u = r.data;
          if (u) {
            const fullName = [u.title, u.firstName, u.lastName].filter(Boolean).join(' ').trim();
            setCurrentUser({ name: fullName || u.email, role: u.role?.name });
          }
        }).catch(() => {});

        return Promise.all([...projectCalls, bibCall]);
      })
      .then((all) => {
        const [ov, rad, tml, res, cord, fnd, inst] = all;
        setOverview(ov); setRadar(rad); setTimeline(tml || []); setResearchers(res);
        setInstitutional(inst); setCordisProjects(cord || []); setFunding(fnd);
      })
      .catch(() => setError('Rapor hazırlanamadı'))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    if (!loading && !error && overview) {
      const t = setTimeout(() => window.print(), 900);
      return () => clearTimeout(t);
    }
  }, [loading, error, overview]);

  if (loading) return <div style={s.center}><p style={s.muted}>Dönemsel rapor hazırlanıyor...</p></div>;
  if (error) return <div style={s.center}><p style={s.err}>{error}</p></div>;

  const presetLabel = PRESET_LABELS[preset] || preset;

  // Dönem içindeki timeline verileri - sadece from-to arasındaki aylar/dönemler
  const filteredTimeline = timeline.filter((t: any) => {
    if (!t.period) return false;
    // period: "2025-10" veya benzer formatta
    const tDate = new Date(t.period + (t.period.length === 7 ? '-01' : ''));
    return tDate >= new Date(from) && tDate <= new Date(to);
  });

  return (
    <>
      <style>{`
        @page {
          size: A4;
          margin: 15mm 14mm 18mm 14mm;
          @bottom-right {
            content: "Sayfa " counter(page) " / " counter(pages);
            font-family: system-ui, sans-serif; font-size: 9pt; color: #6b7280;
          }
          @bottom-left {
            content: "${institutionName.replace(/"/g, '\\"')} · Dönemsel Rapor";
            font-family: system-ui, sans-serif; font-size: 9pt; color: #9ca3af;
          }
        }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div style={s.page}>
        <div className="no-print" style={s.toolbar}>
          <button onClick={() => window.print()} style={s.btnPrimary}>PDF olarak kaydet</button>
          <button onClick={() => window.close()} style={s.btnSecondary}>Kapat</button>
          <span style={s.tbHint}>Rapor hazır - otomatik print açılıyor</span>
        </div>

        {/* KAPAK */}
        <div style={{ ...s.section, ...s.coverPage }}>
          <div style={s.coverTop}>
            <div>
              <p style={s.coverDate}>{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p style={s.coverInst}>{institutionName}</p>
            </div>
            <div style={s.coverLogoBox}>
              {logoUrl ? (
                <img src={logoUrl} alt="Kurum Logosu" style={{ display: 'block', maxWidth: 60, maxHeight: 60, objectFit: 'contain' }} />
              ) : (
                <svg viewBox="0 0 60 60" width="60" height="60" style={{ display: 'block' }}>
                  <circle cx="30" cy="30" r="28" fill="none" stroke="#c8a45a" strokeWidth="1.5" />
                  <text x="30" y="36" textAnchor="middle" fill="#c8a45a" fontSize="18" fontWeight="700" fontFamily="system-ui">MKÜ</text>
                </svg>
              )}
            </div>
          </div>
          <div style={s.coverMid}>
            <p style={s.coverEyebrow}>DÖNEMSEL RAPOR</p>
            <h1 style={s.coverTitle}>{presetLabel}</h1>
            <p style={s.coverDates}>{formatDate(from)} → {formatDate(to)}</p>
            <p style={s.coverSubtitle}>
              {days} günlük dönem · {overview?.total || 0} proje kapsandı
            </p>
            <div style={s.coverFactBox}>
              <div><p style={s.coverFactNum}>{formatNum(overview?.total || 0)}</p><p style={s.coverFactLbl}>Proje</p></div>
              <div><p style={s.coverFactNum}>{formatNum(overview?.activeProjects || 0)}</p><p style={s.coverFactLbl}>Aktif</p></div>
              <div><p style={s.coverFactNum}>{formatNum(overview?.completedProjects || 0)}</p><p style={s.coverFactLbl}>Tamamlanan</p></div>
              <div><p style={s.coverFactNum}>{formatTry(overview?.totalBudget || 0)}</p><p style={s.coverFactLbl}>Toplam Bütçe</p></div>
            </div>
          </div>
          <div style={s.coverBottom}>
            <p style={s.coverDataSrc}>{institutionName} - Teknoloji Transfer Ofisi</p>
          </div>
        </div>

        {/* ÖZET */}
        <div style={s.section}>
          <h2 style={s.h2}>DÖNEM ÖZETİ</h2>
          <p style={s.p}>
            <strong>{presetLabel}</strong> aralığında ({formatDate(from)} - {formatDate(to)}, {days} gün) başlatılan,
            aktif duruma geçen veya statüsü değişen projeler bu rapora dahil edilmiştir.
          </p>

          <h3 style={s.h3}>Ana Göstergeler</h3>
          <div style={s.kpiGrid}>
            <Kpi label="Dönem İçi Proje" value={formatNum(overview?.total || 0)} color="#1a3a6b" />
            <Kpi label="Aktif" value={formatNum(overview?.activeProjects || 0)} color="#059669" />
            <Kpi label="Tamamlanan" value={formatNum(overview?.completedProjects || 0)} color="#2563eb" />
            <Kpi label="Beklemede" value={formatNum((overview?.pendingProjects || 0))} color="#d97706" />
            <Kpi label="İptal" value={formatNum(overview?.cancelledProjects || 0)} color="#dc2626" />
            <Kpi label="Başarı Oranı" value={`%${overview?.successRate || 0}`} color="#7c3aed" sub="kararlaşan" />
          </div>

          <h3 style={s.h3}>Bütçe Göstergeleri</h3>
          <div style={s.kpiGrid}>
            <Kpi label="Toplam Bütçe" value={formatTry(overview?.totalBudget || 0)} color="#c8a45a" />
            <Kpi label="Aktif Bütçe" value={formatTry(overview?.activeBudget || 0)} color="#059669" />
            <Kpi label="Ortalama Bütçe" value={formatTry(overview?.avgBudget || 0)} color="#0891b2" />
          </div>
        </div>

        {/* DURUM DAĞILIMI */}
        {overview?.byStatus?.length > 0 && (
          <div style={s.section}>
            <h2 style={s.h2}>PROJE DURUM DAĞILIMI</h2>
            {overview.byStatus.filter((b: any) => b.count > 0).map((b: any) => {
              const pct = overview.total > 0 ? (b.count / overview.total) * 100 : 0;
              return (
                <div key={b.status} style={s.statusRow}>
                  <span style={{ ...s.statusLabel, color: STATUS_COLORS[b.status] }}>{STATUS_LABELS[b.status] || b.status}</span>
                  <div style={s.barTrack}><div style={{ ...s.barFill, width: `${pct}%`, background: STATUS_COLORS[b.status] }} /></div>
                  <span style={s.statusCount}>{b.count}</span>
                  <span style={s.statusPct}>%{Math.round(pct)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* PROJE TÜRÜNE GÖRE */}
        {overview?.byType?.length > 0 && (
          <div style={s.section}>
            <h2 style={s.h2}>PROJE TÜRÜNE GÖRE DAĞILIM</h2>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Tür</th>
                  <th style={s.thR}>Adet</th>
                  <th style={s.thR}>Pay</th>
                </tr>
              </thead>
              <tbody>
                {overview.byType.map((t: any) => {
                  const pct = overview.total > 0 ? (t.count / overview.total) * 100 : 0;
                  return (
                    <tr key={t.type}>
                      <td style={s.td}>{t.type}</td>
                      <td style={s.tdR}>{t.count}</td>
                      <td style={s.tdR}>%{pct.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* FAKÜLTE ÖZETİ (dönem filtresi yok - aktif kurum görünümü) */}
        {radar.length > 0 && (
          <div style={s.section}>
            <h2 style={s.h2}>FAKÜLTE GÖRÜNÜMÜ</h2>
            <p style={s.p}>
              <em>Bu bölüm genel kurum görünümüdür - dönem filtresi uygulanmaz.
              Dönem içi proje sayıları yukarıdaki durum dağılımındadır.</em>
            </p>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Fakülte</th>
                  <th style={s.thR}>Toplam</th>
                  <th style={s.thR}>Aktif</th>
                  <th style={s.thR}>Tamamlanan</th>
                  <th style={s.thR}>Başarı</th>
                </tr>
              </thead>
              <tbody>
                {radar.slice(0, 12).map((f: any) => (
                  <tr key={f.faculty}>
                    <td style={s.td}>{f.faculty}</td>
                    <td style={s.tdR}>{f.totalProjects}</td>
                    <td style={s.tdR}>{f.activeProjects}</td>
                    <td style={s.tdR}>{f.completedProjects}</td>
                    <td style={{ ...s.tdR, fontWeight: 700 }}>%{f.successRate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* DÖNEM İÇİ ZAMAN ÇİZELGESİ */}
        {filteredTimeline.length > 0 && (
          <div style={s.section}>
            <h2 style={s.h2}>DÖNEM İÇİ ZAMAN SEYRİ</h2>
            <p style={s.p}>Dönem içi aylık/haftalık proje hareketleri.</p>
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
                {filteredTimeline.map((t: any) => (
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

        {/* BİBLİYOMETRİK GÖSTERGELER (DÖNEM FİLTRELİ) */}
        {bibliometricsEnabled && institutional && institutional.configured !== false && (
          <div style={s.section}>
            <h2 style={s.h2}>BİBLİYOMETRİK GÖSTERGELER {institutional.isPeriodFiltered ? `(${institutional.periodLabel})` : '(KURUM GENEL)'}</h2>
            <p style={s.p}>
              {institutional.isPeriodFiltered ? (
                <em>Bibliyometri göstergeleri <strong>{institutional.periodLabel}</strong> yayın yılına göre filtrelenmiştir.
                Yayın yılı dönem içinde olanlar sayılır - atıflar bugüne kadar alınan toplamdır.</em>
              ) : (
                <em>Bibliyometri göstergeleri kurum genelidir. Dönem için yıl filtresi uygulanmak üzere period-report parametresi geçirilmelidir.</em>
              )}
            </p>
            <div style={s.kpiGrid}>
              <Kpi label="Toplam Yayın" value={formatNum(institutional.total || 0)} color="#1a3a6b" />
              <Kpi label="Toplam Atıf" value={formatNum(institutional.totalCitations || 0)} color="#7c3aed" />
              <Kpi label="h-index" value={institutional.hIndex || 0} color="#c8a45a" />
              <Kpi label="i10-index" value={formatNum(institutional.i10Index || 0)} color="#059669" />
              <Kpi label="Açık Erişim" value={`%${institutional.openAccessRatio || 0}`} color="#0891b2" sub={`${formatNum(institutional.openAccessCount || 0)} yayın`} />
              <Kpi label="2 Yıl Ort. Atıf" value={institutional.twoYearMeanCitedness !== undefined ? (+institutional.twoYearMeanCitedness).toFixed(2) : '-'} color="#2563eb" />
            </div>

            {/* Top-cited publications örneklem */}
            {institutional.publications && institutional.publications.length > 0 && (() => {
              const topCited = [...institutional.publications]
                .sort((a: any, b: any) => (b?.citedBy?.best || 0) - (a?.citedBy?.best || 0))
                .slice(0, 10);
              return (
                <>
                  <h3 style={s.h3}>En Çok Atıf Alan 10 Yayın (kurum geneli)</h3>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>#</th>
                        <th style={s.th}>Başlık</th>
                        <th style={s.th}>Dergi</th>
                        <th style={s.thR}>Yıl</th>
                        <th style={s.thR}>Atıf</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCited.map((p: any, i: number) => (
                        <tr key={p.doi || i}>
                          <td style={s.td}>{i + 1}</td>
                          <td style={s.tdSmall}>{p.title}</td>
                          <td style={s.tdSmall}>{p.journal || '-'}</td>
                          <td style={s.tdR}>{p.year || '-'}</td>
                          <td style={{ ...s.tdR, fontWeight: 700 }}>{p.citedBy?.best || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              );
            })()}

            {/* Yıllık trend */}
            {institutional.byYear && institutional.byYear.length > 0 && (() => {
              const byYear = institutional.byYear.slice(-8); // son 8 yıl
              const maxPub = Math.max(1, ...byYear.map((y: any) => y.count || 0));
              return (
                <>
                  <h3 style={s.h3}>Son 8 Yıl Yayın Sayısı</h3>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Yıl</th>
                        <th style={s.thR}>Yayın</th>
                        <th style={s.thR}>Atıf</th>
                        <th style={s.thR}>Oran</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byYear.map((y: any) => (
                        <tr key={y.year}>
                          <td style={s.td}>{y.year}</td>
                          <td style={{ ...s.tdR, fontWeight: 700 }}>{y.count}</td>
                          <td style={s.tdR}>{y.citations}</td>
                          <td style={s.tdR}>{maxPub > 0 ? Math.round((y.count / maxPub) * 100) : 0}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              );
            })()}

            {/* Dergi kalitesi */}
            {institutional.quartileDistribution && Object.values(institutional.quartileDistribution).some((v: any) => v > 0) && (
              <>
                <h3 style={s.h3}>Dergi Kalite Dağılımı (örneklem)</h3>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Q Kademesi</th>
                      <th style={s.thR}>Yayın</th>
                      <th style={s.thR}>Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['Q1','Q2','Q3','Q4','unknown'].map(k => {
                      const count = institutional.quartileDistribution[k] || 0;
                      const total = ['Q1','Q2','Q3','Q4','unknown'].reduce((x, kk) => x + (institutional.quartileDistribution[kk] || 0), 0);
                      const pct = total > 0 ? (count / total) * 100 : 0;
                      return (
                        <tr key={k}>
                          <td style={s.td}>{k === 'unknown' ? 'Bilinmiyor' : k}</td>
                          <td style={{ ...s.tdR, fontWeight: 700 }}>{count}</td>
                          <td style={s.tdR}>%{pct.toFixed(1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}

            {/* Yayın türü dağılımı */}
            {institutional.typeDistribution && institutional.typeDistribution.length > 0 && (
              <>
                <h3 style={s.h3}>Yayın Türüne Göre Dağılım (örneklem)</h3>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Tür</th>
                      <th style={s.thR}>Adet</th>
                      <th style={s.thR}>Toplam Atıf</th>
                      <th style={s.thR}>Ort. Atıf</th>
                    </tr>
                  </thead>
                  <tbody>
                    {institutional.typeDistribution.map((t: any) => (
                      <tr key={t.label}>
                        <td style={s.td}>{t.label}</td>
                        <td style={{ ...s.tdR, fontWeight: 700 }}>{t.count}</td>
                        <td style={s.tdR}>{formatNum(t.citations)}</td>
                        <td style={s.tdR}>{t.count > 0 ? (t.citations / t.count).toFixed(1) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* Uluslararası işbirliği */}
            {institutional.countryCollaboration && institutional.countryCollaboration.length > 0 && (
              <>
                <h3 style={s.h3}>Uluslararası İşbirliği (ilk 10 ülke, örneklem)</h3>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>#</th>
                      <th style={s.th}>Ülke Kodu</th>
                      <th style={s.thR}>Ortak Yayın</th>
                    </tr>
                  </thead>
                  <tbody>
                    {institutional.countryCollaboration.slice(0, 10).map((c: any, i: number) => (
                      <tr key={c.code}>
                        <td style={s.td}>{i + 1}</td>
                        <td style={s.td}>{c.code}</td>
                        <td style={{ ...s.tdR, fontWeight: 700 }}>{c.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* AB PROJELERİ */}
        {cordisProjects.length > 0 && (
          <div style={s.section}>
            <h2 style={s.h2}>ULUSLARARASI FONLAMA (CORDIS)</h2>
            <p style={s.p}><em>Kurum geneli - dönem filtresi yok.</em></p>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Program</th>
                  <th style={s.th}>Akronim</th>
                  <th style={s.th}>Başlık</th>
                  <th style={s.thR}>AB Katkısı</th>
                </tr>
              </thead>
              <tbody>
                {cordisProjects.slice(0, 10).map((p: any) => (
                  <tr key={p.id}>
                    <td style={s.td}>{p.framework}</td>
                    <td style={s.td}>{p.acronym || '-'}</td>
                    <td style={{ ...s.tdSmall }}>{p.title}</td>
                    <td style={s.tdR}>{p.ecMaxContribution ? '€' + Number(p.ecMaxContribution).toLocaleString('tr-TR') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* FONLAMA KAYNAKLARI */}
        {funding?.bySource && funding.bySource.length > 0 && (
          <div style={s.section}>
            <h2 style={s.h2}>FONLAMA KAYNAĞI BAŞARI ORANI</h2>
            <p style={s.p}><em>Kurum geneli - dönem filtresi yok.</em></p>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Kaynak</th>
                  <th style={s.thR}>Başvuru</th>
                  <th style={s.thR}>Kabul</th>
                  <th style={s.thR}>Başarı</th>
                </tr>
              </thead>
              <tbody>
                {funding.bySource.map((f: any) => (
                  <tr key={f.source}>
                    <td style={s.td}>{f.source || '-'}</td>
                    <td style={s.tdR}>{f.totalApplications || 0}</td>
                    <td style={s.tdR}>{f.accepted || 0}</td>
                    <td style={{ ...s.tdR, fontWeight: 700 }}>%{f.successRate || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Dönem içindeki tdR tdSmall */}
        {/* DÖNEMİN EN AKTİF ARAŞTIRMACILARI */}
        {researchers.length > 0 && (
          <div style={s.section}>
            <h2 style={s.h2}>EN ÜRETKEN ARAŞTIRMACILAR</h2>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>#</th>
                  <th style={s.th}>Araştırmacı</th>
                  <th style={s.th}>Fakülte</th>
                  <th style={s.thR}>Toplam</th>
                  <th style={s.thR}>Aktif</th>
                  <th style={s.thR}>Bütçe</th>
                </tr>
              </thead>
              <tbody>
                {researchers.map((r: any, i: number) => (
                  <tr key={r.userId}>
                    <td style={s.td}>{i + 1}</td>
                    <td style={{ ...s.td, fontWeight: i < 3 ? 700 : 400 }}>{r.name}</td>
                    <td style={s.td}>{r.faculty || '-'}</td>
                    <td style={s.tdR}>{r.total}</td>
                    <td style={s.tdR}>{r.active}</td>
                    <td style={s.tdR}>{formatTry(r.totalBudget)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* METODOLOJİ + İMZA */}
        <div style={s.section}>
          <h2 style={s.h2}>METODOLOJİ VE NOT</h2>
          <p style={s.p}>
            <strong>Kapsam:</strong> Dönem içi metrikler için projenin "başlangıç tarihi" (startDate)
            baz alınır. Bu tarihe göre seçili aralıkta olan projeler raporda yer alır.
          </p>
          <p style={s.p}>
            <strong>Başarı oranı:</strong> Sadece karara bağlanmış projeler (tamamlanan + iptal)
            üzerinden. Aktif veya beklemede projeler oranı bozmaz.
          </p>
          <p style={s.p}>
            <strong>Fakülte görünümü:</strong> Kurum geneli anlık görünüm - seçili dönemle sınırlı değil.
          </p>

          <div style={s.footerMeta}>
            <p>Rapor türü: {presetLabel} · Tarih aralığı: {from} → {to}</p>
            <p>Oluşturulma: {new Date().toLocaleString('tr-TR')}</p>
            <div style={s.signatureBlock}>
              <div style={s.signCell}>
                <div style={s.signLine}></div>
                <p style={s.signLbl}>Hazırlayan</p>
                {/* Sistem Yoneticisi (Super Admin) raporlarda gorunmesin - genel "TTO Direktorlugu" gosterilir */}
                {(() => {
                  const isSuperAdmin = currentUser?.role === 'Süper Admin';
                  const showName = !isSuperAdmin && currentUser?.name;
                  const showRole = !isSuperAdmin && currentUser?.role;
                  return (
                    <>
                      <p style={s.signName}>{showName ? currentUser!.name : 'TTO Direktörlüğü'}</p>
                      {showRole && <p style={s.signRole}>{currentUser!.role}</p>}
                    </>
                  );
                })()}
              </div>
              <div style={s.signCell}>
                <div style={s.signLine}></div>
                <p style={s.signLbl}>Onaylayan</p>
                <p style={s.signName}>{rectorName}</p>
                <p style={s.signRole}>Rektör</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: any; sub?: string; color: string }) {
  return (
    <div style={{ ...s.kpi, borderColor: color + '44' }}>
      <p style={{ ...s.kpiValue, color }}>{value}</p>
      <p style={s.kpiLabel}>{label}</p>
      {sub && <p style={s.kpiSub}>{sub}</p>}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: '210mm', margin: '0 auto', padding: '14mm', background: 'white', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1f2937', fontSize: 11, lineHeight: 1.45 },
  center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' },
  muted: { color: '#6b7280' },
  err: { color: '#dc2626' },

  toolbar: { position: 'sticky', top: 0, background: '#0f2444', padding: '10px 14mm', margin: '-14mm -14mm 16px', display: 'flex', alignItems: 'center', gap: 10, zIndex: 10 },
  btnPrimary: { background: '#c8a45a', color: '#0f2444', padding: '8px 16px', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 12 },
  btnSecondary: { background: 'white', color: '#0f2444', padding: '8px 16px', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 12 },
  tbHint: { color: 'white', fontSize: 11, opacity: 0.7 },

  section: { marginBottom: 22, pageBreakInside: 'avoid' },
  coverPage: { minHeight: '260mm', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(135deg, #0f2444 0%, #1a3a6b 100%)', color: 'white', padding: '24mm', margin: '-14mm -14mm 22px', pageBreakAfter: 'always' },
  coverTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: 11, opacity: 0.9 },
  coverLogoBox: { background: 'rgba(255,255,255,0.08)', padding: 8, borderRadius: 12, border: '1px solid rgba(200,164,90,0.4)' },
  coverDate: { margin: 0 },
  coverInst: { margin: '4px 0 0', fontWeight: 700, fontSize: 13 },
  coverMid: { textAlign: 'center' },
  coverEyebrow: { fontSize: 12, color: '#c8a45a', margin: 0, letterSpacing: 3, textTransform: 'uppercase' as const, fontWeight: 600 },
  coverTitle: { fontSize: 36, fontWeight: 700, margin: '6px 0 16px', lineHeight: 1.15, letterSpacing: 1 },
  coverDates: { fontSize: 18, fontWeight: 600, margin: 0, color: '#c8a45a' },
  coverSubtitle: { fontSize: 13, margin: '10px auto 0', maxWidth: 500, opacity: 0.85, lineHeight: 1.6 },
  coverFactBox: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, maxWidth: 500, margin: '36px auto 0' },
  coverFactNum: { fontSize: 24, fontWeight: 700, color: '#c8a45a', margin: 0, lineHeight: 1 },
  coverFactLbl: { fontSize: 10, margin: '4px 0 0', opacity: 0.7, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  coverBottom: { fontSize: 9, opacity: 0.6, textAlign: 'center' },
  coverDataSrc: { margin: 0 },

  h2: { fontSize: 14, fontWeight: 700, color: '#0f2444', margin: '0 0 6px', paddingBottom: 6, borderBottom: '2px solid #0f2444' },
  h3: { fontSize: 12, fontWeight: 700, color: '#374151', margin: '14px 0 6px' },
  p: { fontSize: 11, margin: '0 0 10px', color: '#4b5563' },

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

  footerMeta: { marginTop: 14, paddingTop: 8, borderTop: '1px solid #e5e7eb', fontSize: 9, color: '#9ca3af', textAlign: 'center' as const },
  signatureBlock: { marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' },
  signCell: { textAlign: 'center' as const },
  signLine: { height: 1, background: '#374151', margin: '30px 10px 6px' },
  signLbl: { fontSize: 9, color: '#6b7280', margin: 0, textTransform: 'uppercase' as const, letterSpacing: 1 },
  signName: { fontSize: 11, color: '#0f2444', margin: '4px 0 0', fontWeight: 700 },
  signRole: { fontSize: 9, color: '#6b7280', margin: '2px 0 0', fontStyle: 'italic' as const },
};

export default function PeriodReportPage() {
  return (
    <Suspense fallback={<div style={s.center}><p style={s.muted}>Yükleniyor...</p></div>}>
      <PeriodReportContent />
    </Suspense>
  );
}
