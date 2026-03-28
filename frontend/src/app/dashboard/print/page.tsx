'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';

const STATUS_LABELS: Record<string, string> = {
  application: 'Başvuru', pending: 'Beklemede', active: 'Aktif',
  completed: 'Tamamlandı', suspended: 'Askıda', cancelled: 'İptal',
};
const STATUS_COLORS: Record<string, string> = {
  application: '#d97706', pending: '#d97706', active: '#059669',
  completed: '#2563eb', suspended: '#6b7280', cancelled: '#dc2626',
};
const TYPE_LABELS: Record<string, string> = {
  tubitak: 'TÜBİTAK', bap: 'BAP', eu: 'AB Projesi', industry: 'Sanayi', other: 'Diğer',
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
}

export default function DashboardPrintPage() {
  const [stats, setStats] = useState<any>(null);
  const [siteName, setSiteName] = useState('MKÜ TTO');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || localStorage.getItem('tto_token') || '';
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios.get(`${base}/dashboard`, { headers }).then(r => setStats(r.data)),
      axios.get(`${base}/settings`, { headers }).then(r => { if (r.data?.site_name) setSiteName(r.data.site_name); }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', fontFamily:'system-ui' }}>
      <p>Veriler yükleniyor...</p>
    </div>
  );
  if (!stats) return <div style={{ padding:40 }}>Veri alınamadı.</div>;

  const byStatus = stats.byStatus || [];
  const byType = stats.byType || [];
  const byFaculty = (stats.byFaculty || []).slice(0, 8);
  const recentProjects = stats.recentProjects || [];
  const budget = stats.budget || {};
  const printDate = new Date().toLocaleDateString('tr-TR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });

  return (
    <>
      <style>{`
        * { box-sizing:border-box; margin:0; padding:0; }
        body { font-family:'Segoe UI',system-ui,sans-serif; background:white; color:#1a1a1a; font-size:11pt; }
        .page { max-width:210mm; margin:0 auto; padding:12mm 14mm; }
        .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0f2444; padding-bottom:10px; margin-bottom:20px; }
        .header-left h1 { font-size:22pt; font-weight:800; color:#0f2444; }
        .header-left p { font-size:9pt; color:#9ca3af; margin-top:2px; }
        .header-right { text-align:right; font-size:9pt; color:#9ca3af; }
        .header-right strong { color:#c8a45a; font-size:11pt; display:block; }
        .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:20px; }
        .kpi-card { border:1.5px solid #e8e4dc; border-radius:10px; padding:14px; text-align:center; }
        .kpi-card .num { font-size:26pt; font-weight:800; }
        .kpi-card .lbl { font-size:8.5pt; color:#6b7280; margin-top:2px; }
        .section { margin-bottom:20px; }
        .section-title { font-size:12pt; font-weight:700; color:#0f2444; border-left:4px solid #c8a45a; padding-left:8px; margin-bottom:10px; }
        .two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:20px; }
        .box { border:1px solid #e8e4dc; border-radius:8px; padding:12px; }
        .status-row { display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid #f5f2ee; }
        .status-row:last-child { border-bottom:none; }
        .status-dot { width:10px; height:10px; border-radius:50%; display:inline-block; margin-right:6px; }
        .status-bar-bg { background:#f0ede8; border-radius:4px; height:6px; flex:1; margin:0 10px; }
        .status-bar { height:6px; border-radius:4px; }
        .project-table { width:100%; border-collapse:collapse; font-size:9pt; }
        .project-table th { background:#0f2444; color:white; padding:7px 8px; text-align:left; font-weight:600; font-size:8pt; }
        .project-table td { padding:6px 8px; border-bottom:1px solid #f5f2ee; }
        .project-table tr:nth-child(even) td { background:#faf8f4; }
        .badge { display:inline-block; padding:2px 7px; border-radius:12px; font-size:7.5pt; font-weight:600; color:white; }
        .budget-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
        .budget-box { background:#faf8f4; border-radius:8px; padding:12px; text-align:center; border:1px solid #e8e4dc; }
        .budget-box .num { font-size:14pt; font-weight:800; color:#0f2444; }
        .budget-box .lbl { font-size:8pt; color:#9ca3af; margin-top:2px; }
        .footer { margin-top:20px; padding-top:10px; border-top:1px solid #e8e4dc; display:flex; justify-content:space-between; font-size:8pt; color:#9ca3af; }
        .print-btn { position:fixed; top:16px; right:16px; background:#0f2444; color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600; z-index:999; box-shadow:0 4px 12px rgba(0,0,0,0.3); }
        @media print { .print-btn { display:none !important; } }
      `}</style>

      <button className="print-btn" onClick={() => window.print()}>🖨️ PDF Olarak Kaydet</button>

      <div className="page">
        <div className="header">
          <div className="header-left">
            <h1>{siteName}</h1>
            <p>Teknoloji Transfer Ofisi — Proje Yönetim Sistemi</p>
          </div>
          <div className="header-right">
            <strong>Genel Bakış Raporu</strong>
            <span>Oluşturulma: {printDate}</span>
          </div>
        </div>

        <div className="kpi-grid">
          {[
            { num: stats.totalProjects||0, lbl:'Toplam Proje', color:'#1a3a6b' },
            { num: stats.activeProjects||0, lbl:'Aktif Proje', color:'#059669' },
            { num: stats.completedProjects||0, lbl:'Tamamlanan', color:'#2563eb' },
            { num: stats.pendingProjects||0, lbl:'Beklemede', color:'#d97706' },
            { num: stats.suspendedProjects||0, lbl:'Askıya Alınan', color:'#6b7280' },
            { num: stats.cancelledProjects||0, lbl:'İptal Edilen', color:'#dc2626' },
            { num: stats.totalUsers||0, lbl:'Aktif Kullanıcı', color:'#7c3aed' },
            { num: stats.endingSoon||0, lbl:'30 Günde Biten', color:'#c8a45a' },
          ].map((k,i) => (
            <div key={i} className="kpi-card">
              <div className="num" style={{ color:k.color }}>{k.num}</div>
              <div className="lbl">{k.lbl}</div>
            </div>
          ))}
        </div>

        <div className="section">
          <div className="section-title">Bütçe Özeti</div>
          <div className="budget-grid">
            <div className="budget-box"><div className="num">{formatCurrency(budget.total||0)}</div><div className="lbl">Toplam Bütçe</div></div>
            <div className="budget-box"><div className="num">{formatCurrency(budget.avg||0)}</div><div className="lbl">Ortalama Bütçe</div></div>
            <div className="budget-box"><div className="num">{formatCurrency(budget.max||0)}</div><div className="lbl">En Yüksek Bütçe</div></div>
          </div>
        </div>

        <div className="two-col">
          <div className="box">
            <div className="section-title">Durum Dağılımı</div>
            {byStatus.map((s: any, i: number) => {
              const total = byStatus.reduce((sum: number, x: any) => sum + +x.count, 0);
              const pct = total > 0 ? Math.round((+s.count/total)*100) : 0;
              const color = STATUS_COLORS[s.status]||'#6b7280';
              return (
                <div key={i} className="status-row">
                  <span><span className="status-dot" style={{ background:color }} />{STATUS_LABELS[s.status]||s.status}</span>
                  <div className="status-bar-bg"><div className="status-bar" style={{ width:`${pct}%`, background:color }} /></div>
                  <span style={{ fontWeight:700, minWidth:32, textAlign:'right' }}>{s.count}</span>
                </div>
              );
            })}
          </div>
          <div className="box">
            <div className="section-title">Proje Türü Dağılımı</div>
            {byType.map((t: any, i: number) => {
              const total = byType.reduce((sum: number, x: any) => sum + +x.count, 0);
              const pct = total > 0 ? Math.round((+t.count/total)*100) : 0;
              return (
                <div key={i} className="status-row">
                  <span style={{ minWidth:80 }}>{TYPE_LABELS[t.type]||t.type}</span>
                  <div className="status-bar-bg"><div className="status-bar" style={{ width:`${pct}%`, background:'#1a3a6b' }} /></div>
                  <span style={{ fontWeight:700, minWidth:32, textAlign:'right' }}>{t.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {byFaculty.length > 0 && (
          <div className="section">
            <div className="section-title">Fakülte Bazlı Dağılım</div>
            <div className="box">
              {byFaculty.map((f: any, i: number) => {
                const max = Math.max(...byFaculty.map((x: any) => +x.count));
                const pct = max > 0 ? Math.round((+f.count/max)*100) : 0;
                return (
                  <div key={i} className="status-row">
                    <span style={{ minWidth:160, fontSize:'9pt' }}>{f.faculty||'Belirtilmemiş'}</span>
                    <div className="status-bar-bg"><div className="status-bar" style={{ width:`${pct}%`, background:'#c8a45a' }} /></div>
                    <span style={{ fontWeight:700, minWidth:32, textAlign:'right' }}>{f.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {recentProjects.length > 0 && (
          <div className="section">
            <div className="section-title">Son Projeler</div>
            <table className="project-table">
              <thead>
                <tr>
                  <th>Proje Adı</th><th>Tür</th><th>Fakülte</th><th>Durum</th><th>Bütçe</th><th>Başlangıç</th>
                </tr>
              </thead>
              <tbody>
                {recentProjects.slice(0,15).map((p: any) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight:600 }}>{p.title}</td>
                    <td>{TYPE_LABELS[p.type]||p.type}</td>
                    <td>{p.faculty||'—'}</td>
                    <td><span className="badge" style={{ background:STATUS_COLORS[p.status]||'#6b7280' }}>{STATUS_LABELS[p.status]||p.status}</span></td>
                    <td>{p.budget ? formatCurrency(p.budget) : '—'}</td>
                    <td>{p.startDate ? new Date(p.startDate).toLocaleDateString('tr-TR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="footer">
          <span>{siteName} — Proje Yönetim Sistemi</span>
          <span>Rapor Tarihi: {printDate}</span>
        </div>
      </div>
    </>
  );
}
