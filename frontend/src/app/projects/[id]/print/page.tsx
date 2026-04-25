'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { Project, ProjectReport } from '@/types';
import { PROJECT_STATUS_LABELS, getProjectTypeLabel, formatDate, formatCurrency, getInitials } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  active: '#059669', pending: '#d97706', completed: '#2563eb',
  suspended: '#6b7280', cancelled: '#dc2626',
};

export default function ProjectPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject]     = useState<Project | null>(null);
  const [reports, setReports]     = useState<ProjectReport[]>([]);
  const [linkedPubs, setLinkedPubs] = useState<any[]>([]);
  const [intelligence, setIntelligence] = useState<any | null>(null);
  const [partners, setPartners]     = useState<any[]>([]);
  const [auditLogs, setAuditLogs]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const token = sessionStorage.getItem('tto_print_token') || localStorage.getItem('tto_token') || '';
    const headers = { Authorization: `Bearer ${token}` };

    // Onceden hesaplanmis Is Zekasi raporu varsa localStorage'dan al
    try {
      const cached = localStorage.getItem(`intel_report_${id}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.data) setIntelligence(parsed.data);
      }
    } catch {}

    Promise.all([
      axios.get(`${base}/projects/${id}`, { headers }).then(r => setProject(r.data)),
      axios.get(`${base}/projects/${id}/reports`, { headers }).then(r => setReports(r.data)).catch(() => {}),
      axios.get(`${base}/scopus/project/${id}/linked-publications`, { headers }).then(r => setLinkedPubs(r.data || [])).catch(() => {}),
      axios.get(`${base}/projects/${id}/partners`, { headers }).then(r => setPartners(r.data || [])).catch(() => {}),
      axios.get(`${base}/audit/project/${id}`, { headers }).then(r => setAuditLogs(r.data || [])).catch(() => {}),
    ]).finally(() => {
      setLoading(false);
    });
  }, [id]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui' }}>
      <div>Proje yükleniyor...</div>
    </div>
  );
  if (!project) return <div>Proje bulunamadı</div>;

  const handlePrint = () => window.print();

  const sc = STATUS_COLORS[project.status] || '#6b7280';
  const latestReport = reports[0];
  const progressReports = reports.filter(r => r.type === 'progress' || r.progressPercent > 0);
  const latestProgress = latestReport?.progressPercent || 0;

  const TYPE_LABELS: Record<string, string> = {
    progress: 'İlerleme Raporu', milestone: 'Kilometre Taşı', financial: 'Finansal Rapor',
    technical: 'Teknik Rapor', risk: 'Risk Raporu', final: 'Final Rapor',
  };

  return (
    <>
      <style>{`
        @media screen {
          .print-btn { position: fixed; top: 16px; right: 16px; z-index: 999; background: #0f2444; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
          .print-btn:hover { background: #1a3a6b; }
        }
        @media print { .print-btn { display: none !important; } }
      `}</style>
      <button className="print-btn" onClick={handlePrint}>🖨️ PDF Olarak Kaydet</button>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #f5f5f5; color: #1a1a1a; font-size: 10.5pt; line-height: 1.55; -webkit-font-smoothing: antialiased; }

        .page { max-width: 210mm; margin: 0 auto; padding: 14mm 16mm; background: white; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }

        /* Kapak / Ust baslik - kurumsal stil */
        .header { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: flex-start;
          border-bottom: 3px double #0f2444; padding-bottom: 14px; margin-bottom: 22px; }
        .header-left h1 { font-size: 18pt; font-weight: 700; color: #0f2444; margin-bottom: 4px; line-height: 1.25; letter-spacing: -0.01em; }
        .header-left .subtitle { font-size: 10pt; color: #6b7280; line-height: 1.4; }
        .header-right { text-align: right; }
        .header-right .status { display: inline-block; padding: 5px 14px; border-radius: 99px; font-size: 9pt; font-weight: 700;
          color: white; letter-spacing: 0.02em; text-transform: uppercase; }
        .header-right .date { font-size: 8.5pt; color: #9ca3af; margin-top: 6px; }
        .mku-logo { font-size: 9pt; font-weight: 700; color: #c8a45a; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 6px; }
        .doc-id { font-size: 8pt; color: #9ca3af; margin-top: 4px; font-family: 'SF Mono', Consolas, monospace; }

        /* Section basliklari */
        .section { margin-bottom: 22px; page-break-inside: avoid; }
        .section-title { font-size: 10.5pt; font-weight: 700; color: #0f2444; text-transform: uppercase; letter-spacing: 0.06em;
          border-bottom: 2px solid #0f2444; padding-bottom: 5px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .section-title::before { content: ''; width: 4px; height: 14px; background: #c8a45a; border-radius: 2px; }
        .section-subtitle { font-size: 8.5pt; color: #6b7280; margin-bottom: 10px; margin-top: -6px; font-style: italic; }

        /* Info grid - daha hizali, daha okunakli */
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
        .info-item { display: flex; flex-direction: column; padding: 6px 10px; background: #faf8f4; border-left: 2px solid #c8a45a; border-radius: 0 4px 4px 0; }
        .info-label { font-size: 8pt; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
        .info-value { font-size: 10pt; color: #0f2444; font-weight: 600; margin-top: 2px; line-height: 1.3; }
        
        /* Butce kutulari - kurumsal mavi */
        .budget-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
        .budget-box { background: linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%);
          border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px 14px; }
        .budget-box .label { font-size: 8pt; color: #1d4ed8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
        .budget-box .value { font-size: 14pt; font-weight: 700; color: #0f2444; margin-top: 2px; }
        .budget-box .sub { font-size: 7.5pt; color: #6b7280; margin-top: 2px; }

        /* Progress bar */
        .progress-wrap { margin: 12px 0; }
        .progress-label { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 9pt; }
        .progress-track { height: 12px; background: #f0ede8; border-radius: 99px; overflow: hidden; position: relative; }
        .progress-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, #0f2444, #1a3a6b, #c8a45a); }

        /* Uyeler - daha temiz */
        .members-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .member-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; display: flex; align-items: center; gap: 10px; background: white; }
        .member-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
          font-size: 9pt; font-weight: 700; color: white; flex-shrink: 0; background: linear-gradient(135deg, #1a3a6b, #0f2444); }
        .member-info { flex: 1; min-width: 0; }
        .member-name { font-size: 10pt; font-weight: 600; color: #0f2444; }
        .member-role { font-size: 8pt; color: #6b7280; margin-top: 1px; }
        
        /* Raporlar */
        .report-item { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; page-break-inside: avoid; }
        .report-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; }
        .report-title { font-size: 10pt; font-weight: 600; color: #0f2444; }
        .report-meta { font-size: 8pt; color: #9ca3af; margin-top: 2px; }
        .report-badge { font-size: 8pt; font-weight: 600; padding: 2px 8px; border-radius: 99px; }
        .report-content { font-size: 9pt; color: #374151; line-height: 1.5; margin-top: 6px; }
        .report-progress { font-size: 13pt; font-weight: 700; color: #0f2444; flex-shrink: 0; margin-left: 10px; }
        
        /* Meta data kutuları (risk, finansal vb.) */
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 6px; }
        .meta-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 8px; }
        .meta-box .label { font-size: 7.5pt; color: #9ca3af; font-weight: 600; }
        .meta-box .value { font-size: 8.5pt; color: #1a1a1a; margin-top: 1px; }
        
        /* Is Zekasi Skorlari */
        .intel-scores { display: grid; grid-template-columns: 1.2fr 1fr 1fr 1fr 1fr; gap: 8px; margin-bottom: 14px; }
        .intel-score-box { padding: 12px 10px; border-radius: 10px; text-align: center; }
        .intel-score-box.main { background: linear-gradient(135deg, #0f2444 0%, #1a3a6b 100%); color: white; }
        .intel-score-box.dim { background: white; border: 1px solid #e5e7eb; }
        .intel-score-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.85; }
        .intel-score-value { font-size: 22pt; font-weight: 700; line-height: 1.1; margin-top: 2px; }
        .intel-score-suffix { font-size: 7.5pt; opacity: 0.7; }
        .intel-score-bar { height: 4px; background: #f0ede8; border-radius: 99px; margin-top: 6px; overflow: hidden; }
        .intel-score-bar-fill { height: 100%; border-radius: 99px; }

        /* Is Zekasi narrative + listeler */
        .intel-narrative { padding: 12px 14px; background: #faf8f4; border-radius: 8px; border-left: 3px solid #c8a45a;
          font-size: 9.5pt; color: #1f2937; line-height: 1.65; margin-bottom: 12px; }
        .intel-narrative p + p { margin-top: 8px; }
        .intel-lists { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .intel-list-card { border-radius: 8px; padding: 10px 12px; }
        .intel-list-card.pos { background: #f0fdf4; border: 1px solid #86efac; }
        .intel-list-card.neg { background: #fef2f2; border: 1px solid #fca5a5; }
        .intel-list-card.act { background: #eff6ff; border: 1px solid #93c5fd; }
        .intel-list-title { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
        .intel-list-card.pos .intel-list-title { color: #047857; }
        .intel-list-card.neg .intel-list-title { color: #b91c1c; }
        .intel-list-card.act .intel-list-title { color: #1d4ed8; }
        .intel-list-card ul { list-style: none; }
        .intel-list-card li { font-size: 9pt; color: #1f2937; margin-bottom: 4px; padding-left: 10px; position: relative; line-height: 1.4; }
        .intel-list-card li::before { content: '•'; position: absolute; left: 0; }

        /* Ortaklar */
        .partner-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .partner-card { padding: 8px 12px; background: #f9fafb; border-left: 3px solid #7c3aed; border-radius: 0 6px 6px 0; }
        .partner-name { font-size: 9.5pt; font-weight: 600; color: #0f2444; }
        .partner-meta { font-size: 8pt; color: #6b7280; margin-top: 2px; }

        /* Audit timeline */
        .audit-timeline { border-left: 2px solid #e5e7eb; padding-left: 14px; }
        .audit-item { position: relative; padding-bottom: 8px; font-size: 8.5pt; }
        .audit-item::before { content: ''; position: absolute; left: -19px; top: 4px; width: 8px; height: 8px;
          border-radius: 50%; background: #c8a45a; border: 2px solid white; box-shadow: 0 0 0 1px #e5e7eb; }
        .audit-action { font-weight: 600; color: #0f2444; }
        .audit-meta { color: #9ca3af; font-size: 7.5pt; }

        /* Altbilgi - daha kurumsal */
        .footer { margin-top: 30px; padding-top: 14px; border-top: 2px solid #0f2444; display: grid;
          grid-template-columns: 1fr auto; gap: 8px; font-size: 8pt; color: #6b7280; }
        .footer .left { font-weight: 600; color: #0f2444; }
        .footer .gen { font-style: italic; }

        /* Baski ayarlari */
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
          .page { padding: 10mm 12mm; box-shadow: none; }
          .no-print { display: none !important; }
          .report-item, .section { break-inside: avoid; }
          @page { size: A4; margin: 10mm 12mm; }
        }
        
        /* Ekran butonu */
        .print-btn { display: flex; gap: 10px; justify-content: flex-end; margin-bottom: 16px; }
        .print-btn button { padding: 8px 18px; border-radius: 8px; border: 1px solid #e5e7eb; cursor: pointer; font-size: 10pt; font-weight: 500; }
        .print-btn .btn-p { background: #0f2444; color: white; border-color: #0f2444; }
        .print-btn .btn-c { background: white; color: #6b7280; }
      `}</style>

      <div className="page">
        {/* Ekran butonları */}
        <div className="print-btn no-print">
          <button className="btn-c" onClick={() => window.close()}>← Geri</button>
          <button className="btn-p" onClick={() => window.print()}>🖨 Yazdır / PDF Kaydet</button>
        </div>

        {/* Baslik - kapak gibi */}
        <div className="header">
          <div className="header-left">
            <div className="mku-logo">MKÜ · Teknoloji Transfer Ofisi</div>
            <h1>{project.title}</h1>
            <p className="subtitle">
              {getProjectTypeLabel(project.type)}
              {project.faculty ? ` · ${project.faculty}` : ''}
              {project.department ? ` · ${project.department}` : ''}
            </p>
            <p className="doc-id">Belge No: TTO-{project.id?.slice(0, 8).toUpperCase()} · v{(reports.length || 0) + 1}</p>
          </div>
          <div className="header-right">
            <div className="status" style={{ background: sc }}>{PROJECT_STATUS_LABELS[project.status]}</div>
            <div className="date">{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
        </div>

        {/* Proje Bilgileri */}
        <div className="section">
          <div className="section-title">Proje Bilgileri</div>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Yürütücü</span>
              <span className="info-value">{project.owner?.title ? `${project.owner.title} ` : ''}{project.owner?.firstName} {project.owner?.lastName}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Proje Türü</span>
              <span className="info-value">{getProjectTypeLabel(project.type)}</span>
            </div>
            {project.faculty && <div className="info-item">
              <span className="info-label">Fakülte</span>
              <span className="info-value">{project.faculty}</span>
            </div>}
            {project.department && <div className="info-item">
              <span className="info-label">Bölüm</span>
              <span className="info-value">{project.department}</span>
            </div>}
            {project.startDate && <div className="info-item">
              <span className="info-label">Başlangıç</span>
              <span className="info-value">{formatDate(project.startDate)}</span>
            </div>}
            {project.endDate && <div className="info-item">
              <span className="info-label">Bitiş</span>
              <span className="info-value">{formatDate(project.endDate)}</span>
            </div>}
            {project.fundingSource && <div className="info-item">
              <span className="info-label">Destek Kaynağı</span>
              <span className="info-value">{project.fundingSource}</span>
            </div>}
            <div className="info-item">
              <span className="info-label">Kayıt Tarihi</span>
              <span className="info-value">{formatDate(project.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Açıklama */}
        {project.description && (
          <div className="section">
            <div className="section-title">Proje Açıklaması</div>
            <p style={{ fontSize: '9.5pt', color: '#374151', lineHeight: 1.6 }}>{project.description}</p>
          </div>
        )}

        {/* Butce - daha zengin */}
        {project.budget && (
          <div className="section">
            <div className="section-title">Bütçe ve İlerleme</div>
            <div className="budget-row">
              <div className="budget-box">
                <div className="label">Toplam Bütçe</div>
                <div className="value">{formatCurrency(project.budget)}</div>
                {project.fundingSource && <div className="sub">{project.fundingSource}</div>}
              </div>
              {project.startDate && project.endDate && (() => {
                const start = new Date(project.startDate).getTime();
                const end   = new Date(project.endDate).getTime();
                const now   = Date.now();
                const total = end - start;
                const pct   = total > 0 ? Math.min(100, Math.max(0, ((now - start) / total) * 100)) : 0;
                const months = total / (1000 * 60 * 60 * 24 * 30.44);
                return (
                  <>
                    <div className="budget-box">
                      <div className="label">Süre</div>
                      <div className="value">{months.toFixed(0)} ay</div>
                      <div className="sub">{formatDate(project.startDate)} → {formatDate(project.endDate)}</div>
                    </div>
                    <div className="budget-box">
                      <div className="label">Geçen Süre</div>
                      <div className="value">%{pct.toFixed(0)}</div>
                      <div className="sub">Aylık ort. {formatCurrency(project.budget / Math.max(1, months))}</div>
                    </div>
                  </>
                );
              })()}
            </div>
            {latestProgress > 0 && (
              <div className="progress-wrap" style={{ marginTop: 14 }}>
                <div className="progress-label">
                  <span style={{ fontWeight: 600, color: '#0f2444' }}>Son Bildirilen İlerleme</span>
                  <span style={{ fontWeight: 700, color: '#0f2444' }}>%{latestProgress}</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${latestProgress}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* IS ZEKASI RAPORU - localStorage cache'den okunur, varsa yazdirilir */}
        {intelligence && (
          <div className="section">
            <div className="section-title">İş Zekası Raporu</div>
            <p className="section-subtitle">
              13 akademik kaynaktan sentezlenmiş yönetici özeti
              {intelligence.source === 'ai' ? ' · Claude AI' : ' · Kural tabanlı'}
            </p>
            <div className="intel-scores">
              <div className="intel-score-box main">
                <div className="intel-score-label">Genel Skor</div>
                <div className="intel-score-value">{intelligence.overallScore}</div>
                <div className="intel-score-suffix">/ 100</div>
              </div>
              {[
                { k: 'originalityScore',   label: 'Özgünlük' },
                { k: 'competitionScore',   label: 'Rekabet' },
                { k: 'fitScore',           label: 'Dergi Uyumu' },
                { k: 'successProbability', label: 'Başarı' },
              ].map(d => {
                const v = intelligence[d.k] || 0;
                const c = v >= 70 ? '#059669' : v >= 50 ? '#c8a45a' : v >= 30 ? '#d97706' : '#dc2626';
                return (
                  <div key={d.k} className="intel-score-box dim">
                    <div className="intel-score-label" style={{ color: '#6b7280' }}>{d.label}</div>
                    <div className="intel-score-value" style={{ color: c }}>%{v}</div>
                    <div className="intel-score-bar">
                      <div className="intel-score-bar-fill" style={{ width: `${v}%`, background: c }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {intelligence.narrative && (
              <div className="intel-narrative">
                {intelligence.narrative.split('\n').map((p: string, i: number) => <p key={i}>{p}</p>)}
              </div>
            )}
            <div className="intel-lists">
              {intelligence.highlights?.length > 0 && (
                <div className="intel-list-card pos">
                  <div className="intel-list-title">Güçlü Yönler</div>
                  <ul>{intelligence.highlights.slice(0, 5).map((h: string, i: number) => <li key={i}>{h}</li>)}</ul>
                </div>
              )}
              {intelligence.risks?.length > 0 && (
                <div className="intel-list-card neg">
                  <div className="intel-list-title">Riskler</div>
                  <ul>{intelligence.risks.slice(0, 5).map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
                </div>
              )}
              {intelligence.recommendations?.length > 0 && (
                <div className="intel-list-card act">
                  <div className="intel-list-title">Öneriler</div>
                  <ul>{intelligence.recommendations.slice(0, 5).map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ekip - avatar + isim + rol */}
        {((project.members && project.members.length > 0) || project.owner) && (
          <div className="section">
            <div className="section-title">Proje Ekibi ({(project.members?.length || 0) + 1} kişi)</div>
            <div className="members-grid">
              <div className="member-card" style={{ borderColor: '#c8a45a', background: '#fffbeb' }}>
                <div className="member-avatar" style={{ background: 'linear-gradient(135deg, #c8a45a, #92651a)' }}>
                  {getInitials(project.owner?.firstName || '', project.owner?.lastName || '')}
                </div>
                <div className="member-info">
                  <div className="member-name">{project.owner?.title} {project.owner?.firstName} {project.owner?.lastName}</div>
                  <div className="member-role" style={{ color: '#92651a', fontWeight: 600 }}>Yürütücü</div>
                </div>
              </div>
              {(project.members || []).map(m => (
                <div key={m.id} className="member-card">
                  <div className="member-avatar">
                    {getInitials(m.user?.firstName || '', m.user?.lastName || '')}
                  </div>
                  <div className="member-info">
                    <div className="member-name">{m.user?.title} {m.user?.firstName} {m.user?.lastName}</div>
                    <div className="member-role">{m.role === 'researcher' ? 'Araştırmacı' : m.role === 'advisor' ? 'Danışman' : m.role === 'assistant' ? 'Asistan' : m.role}{m.user?.department ? ` · ${m.user.department}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ortaklar */}
        {partners.length > 0 && (
          <div className="section">
            <div className="section-title">Proje Ortakları ({partners.length})</div>
            <div className="partner-grid">
              {partners.map((p: any) => (
                <div key={p.id} className="partner-card">
                  <div className="partner-name">{p.name}</div>
                  <div className="partner-meta">
                    {p.role || 'Ortak'}
                    {p.sector ? ` · ${p.sector}` : ''}
                    {p.contactName ? ` · ${p.contactName}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Belgeler */}
        {project.documents && project.documents.length > 0 && (
          <div className="section">
            <div className="section-title">Belgeler ({project.documents.length})</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
              {project.documents.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                  <span style={{ fontSize: '9pt', color: '#0f2444', fontWeight: 500 }}>{d.name || d.fileName}</span>
                  <span style={{ fontSize: '8pt', color: '#9ca3af', marginLeft: 'auto', flexShrink: 0 }}>{d.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Raporlar */}
        {reports.length > 0 && (
          <div className="section">
            <div className="section-title">Raporlar ({reports.length})</div>
            {reports.map((r, idx) => {
              let meta: Record<string, any> = {};
              try { meta = JSON.parse((r as any).metadata || '{}'); } catch {}
              const rtLabel = TYPE_LABELS[r.type] || r.type;
              const TYPE_COLORS: Record<string, string> = {
                progress: '#1a3a6b', milestone: '#92651a', financial: '#059669',
                technical: '#7c3aed', risk: '#dc2626', final: '#0891b2',
              };
              const rtColor = TYPE_COLORS[r.type] || '#6b7280';

              return (
                <div key={r.id} className="report-item" style={{ borderLeftColor: rtColor, borderLeftWidth: 3 }}>
                  <div className="report-header">
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '8pt', color: '#9ca3af' }}>#{reports.length - idx}</span>
                        <span className="report-title">{r.title}</span>
                        <span className="report-badge" style={{ background: rtColor + '18', color: rtColor, border: `1px solid ${rtColor}30` }}>{rtLabel}</span>
                      </div>
                      <div className="report-meta">
                        {r.author?.firstName} {r.author?.lastName} · {formatDate(r.createdAt)}
                      </div>
                    </div>
                    {r.progressPercent > 0 && (
                      <span className="report-progress">%{r.progressPercent}</span>
                    )}
                  </div>

                  {r.progressPercent > 0 && (
                    <div className="progress-track" style={{ height: 5, margin: '6px 0' }}>
                      <div className="progress-fill" style={{ width: `${r.progressPercent}%`, background: rtColor }} />
                    </div>
                  )}

                  {r.content && <p className="report-content">{r.content}</p>}

                  {/* Meta veriler */}
                  {Object.keys(meta).length > 0 && (
                    <div className="meta-grid">
                      {r.type === 'financial' && <>
                        {meta.totalBudget && <div className="meta-box"><div className="label">Toplam Bütçe</div><div className="value">{formatCurrency(+meta.totalBudget)}</div></div>}
                        {meta.spent && <div className="meta-box"><div className="label">Bu Dönem Harcama</div><div className="value">{formatCurrency(+meta.spent)}</div></div>}
                        {meta.cumulativeSpent && <div className="meta-box"><div className="label">Kümülatif</div><div className="value">{formatCurrency(+meta.cumulativeSpent)}</div></div>}
                        {meta.remaining && <div className="meta-box"><div className="label">Kalan</div><div className="value">{formatCurrency(+meta.remaining)}</div></div>}
                        {meta.period && <div className="meta-box"><div className="label">Dönem</div><div className="value">{meta.period}</div></div>}
                      </>}
                      {r.type === 'milestone' && <>
                        {meta.plannedDate && <div className="meta-box"><div className="label">Planlanan</div><div className="value">{new Date(meta.plannedDate).toLocaleDateString('tr-TR')}</div></div>}
                        {meta.actualDate && <div className="meta-box"><div className="label">Gerçekleşen</div><div className="value">{new Date(meta.actualDate).toLocaleDateString('tr-TR')}</div></div>}
                        {meta.status && <div className="meta-box"><div className="label">Durum</div><div className="value">{meta.status === 'achieved' ? 'Başarıldı' : meta.status === 'delayed' ? 'Ertelendi' : meta.status === 'planned' ? 'Planlandı' : 'İptal'}</div></div>}
                        {meta.impact && <div className="meta-box"><div className="label">Etki</div><div className="value">{meta.impact === 'critical' ? 'Kritik' : meta.impact === 'high' ? 'Yüksek' : meta.impact === 'medium' ? 'Orta' : 'Düşük'}</div></div>}
                        {meta.responsible && <div className="meta-box"><div className="label">Sorumlu</div><div className="value">{meta.responsible}</div></div>}
                      </>}
                      {r.type === 'risk' && <>
                        {meta.probability && <div className="meta-box"><div className="label">Olasılık</div><div className="value">{meta.probability === 'very_high' ? 'Çok Yüksek' : meta.probability === 'high' ? 'Yüksek' : meta.probability === 'medium' ? 'Orta' : 'Düşük'}</div></div>}
                        {meta.impact && <div className="meta-box"><div className="label">Etki</div><div className="value">{meta.impact === 'critical' ? 'Kritik' : meta.impact === 'high' ? 'Yüksek' : meta.impact === 'medium' ? 'Orta' : 'Düşük'}</div></div>}
                        {meta.category && <div className="meta-box"><div className="label">Kategori</div><div className="value">{meta.category}</div></div>}
                        {meta.riskStatus && <div className="meta-box"><div className="label">Durum</div><div className="value">{meta.riskStatus === 'open' ? 'Açık' : meta.riskStatus === 'monitoring' ? 'İzleniyor' : meta.riskStatus === 'mitigated' ? 'Azaltıldı' : 'Kapatıldı'}</div></div>}
                        {meta.mitigation && <div className="meta-box" style={{ gridColumn: 'span 2' }}><div className="label">Önlem</div><div className="value">{meta.mitigation}</div></div>}
                        {meta.owner && <div className="meta-box"><div className="label">Sorumlu</div><div className="value">{meta.owner}</div></div>}
                      </>}
                      {r.type === 'technical' && <>
                        {meta.topic && <div className="meta-box"><div className="label">Konu</div><div className="value">{meta.topic}</div></div>}
                        {meta.methodology && <div className="meta-box"><div className="label">Yöntem</div><div className="value">{meta.methodology}</div></div>}
                        {meta.conclusions && <div className="meta-box" style={{ gridColumn: 'span 2' }}><div className="label">Sonuçlar</div><div className="value">{meta.conclusions}</div></div>}
                        {meta.recommendations && <div className="meta-box" style={{ gridColumn: 'span 2' }}><div className="label">Öneriler</div><div className="value">{meta.recommendations}</div></div>}
                      </>}
                      {r.type === 'final' && <>
                        {meta.evaluation && <div className="meta-box"><div className="label">Değerlendirme</div><div className="value">{meta.evaluation === 'excellent' ? 'Mükemmel' : meta.evaluation === 'good' ? 'İyi' : meta.evaluation === 'average' ? 'Orta' : 'Beklentinin Altı'}</div></div>}
                        {meta.publications && meta.publications !== 'no' && <div className="meta-box"><div className="label">Yayın/Patent</div><div className="value">{meta.publications}</div></div>}
                        {meta.achievements && <div className="meta-box" style={{ gridColumn: 'span 2' }}><div className="label">Başarılar</div><div className="value">{meta.achievements}</div></div>}
                        {meta.lessons && <div className="meta-box" style={{ gridColumn: 'span 2' }}><div className="label">Öğrenilen Dersler</div><div className="value">{meta.lessons}</div></div>}
                      </>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Etik Kurul Durumu */}
        {((project as any).ethicsRequired) && (
          <div className="section">
            <div className="section-title">Etik Kurul Durumu</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div className="info-item">
                <span className="info-label">Etik Kurul Gerekli</span>
                <span className="info-value">{(project as any).ethicsRequired ? 'Evet' : 'Hayır'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Onay Durumu</span>
                <span className="info-value" style={{ color: (project as any).ethicsApproved ? '#059669' : '#d97706' }}>
                  {(project as any).ethicsApproved ? 'Onaylandi' : 'Bekleniyor'}
                </span>
              </div>
              {(project as any).ethicsCommittee && (
                <div className="info-item">
                  <span className="info-label">Kurul</span>
                  <span className="info-value">{(project as any).ethicsCommittee}</span>
                </div>
              )}
              {(project as any).ethicsApprovalNo && (
                <div className="info-item">
                  <span className="info-label">Onay No</span>
                  <span className="info-value">{(project as any).ethicsApprovalNo}</span>
                </div>
              )}
              {(project as any).ethicsApprovalDate && (
                <div className="info-item">
                  <span className="info-label">Onay Tarihi</span>
                  <span className="info-value">{formatDate((project as any).ethicsApprovalDate)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fikri Mülkiyet */}
        {(project as any).ipStatus && (project as any).ipStatus !== 'none' && (
          <div className="section">
            <div className="section-title">Fikri Mülkiyet</div>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Durum</span>
                <span className="info-value">{{ none: 'Yok', pending: 'Başvuru Aşamasında', registered: 'Tescilli', published: 'Yayımlandı' }[(project as any).ipStatus as string] || (project as any).ipStatus}</span>
              </div>
              {(project as any).ipType && (
                <div className="info-item">
                  <span className="info-label">Tür</span>
                  <span className="info-value">{(project as any).ipType}</span>
                </div>
              )}
              {(project as any).ipRegistrationNo && (
                <div className="info-item">
                  <span className="info-label">Tescil No</span>
                  <span className="info-value">{(project as any).ipRegistrationNo}</span>
                </div>
              )}
              {(project as any).ipDate && (
                <div className="info-item">
                  <span className="info-label">Tarih</span>
                  <span className="info-value">{formatDate((project as any).ipDate)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SKH Hedefleri */}
        {(project as any).sdgGoals?.length > 0 && (
          <div className="section">
            <div className="section-title">Sürdürülebilir Kalkinma Hedefleri</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(project as any).sdgGoals.map((code: string) => (
                <span key={code} style={{ padding: '3px 10px', borderRadius: 99, fontSize: '8.5pt', fontWeight: 600, background: '#e0e7ff', color: '#3730a3' }}>
                  {code}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Proje Metni */}
        {(project as any).projectText && (
          <div className="section">
            <div className="section-title">Proje Metni</div>
            <p style={{ fontSize: '9.5pt', color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {(project as any).projectText.substring(0, 3000)}{(project as any).projectText.length > 3000 ? '...' : ''}
            </p>
          </div>
        )}

        {/* YZ Uygunluk Skoru */}
        {(project as any).aiComplianceScore != null && (
          <div className="section">
            <div className="section-title">YZ Uygunluk Analizi</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #1a3a6b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14pt', color: '#1a3a6b', flexShrink: 0 }}>
                {(project as any).aiComplianceScore}
              </div>
              <div>
                <p style={{ fontSize: '9pt', fontWeight: 600, color: '#0f2444' }}>Uygunluk Skoru: {(project as any).aiComplianceScore}/100</p>
                <p style={{ fontSize: '8.5pt', color: '#6b7280' }}>YZ tarafindan degerlendirilmistir</p>
              </div>
            </div>
          </div>
        )}

        {/* Scopus Bağlı Yayınlar */}
        {linkedPubs.length > 0 && (
          <div className="section">
            <div className="section-title">Proje Çıktıları - Scopus Yayınları ({linkedPubs.length})</div>
            {linkedPubs.map((p: any, i: number) => (
              <div key={i} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 8, marginBottom: 8 }}>
                <p style={{ fontSize: '9.5pt', fontWeight: 600, color: '#0f2444', lineHeight: 1.4 }}>{p.title}</p>
                <div style={{ display: 'flex', gap: 12, marginTop: 3, fontSize: '8.5pt', color: '#6b7280', flexWrap: 'wrap' }}>
                  {p.journal && <span>{p.journal}</span>}
                  {p.year && <span>{p.year}</span>}
                  {p.citedBy > 0 && <span style={{ color: '#059669', fontWeight: 600 }}>{p.citedBy} atıf</span>}
                  {p.doi && <span>DOI: {p.doi}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Audit Timeline - son 10 olay */}
        {auditLogs.length > 0 && (
          <div className="section">
            <div className="section-title">Olay Geçmişi (Son {Math.min(10, auditLogs.length)})</div>
            <div className="audit-timeline">
              {auditLogs.slice(0, 10).map((a: any) => {
                const ACTION_TR: Record<string, string> = {
                  create: 'Oluşturuldu', update: 'Güncellendi', delete: 'Silindi',
                  upload: 'Belge yüklendi', report: 'Rapor eklendi', member_add: 'Üye eklendi',
                  member_remove: 'Üye çıkarıldı', status_change: 'Durum değişti',
                };
                const action = ACTION_TR[a.action] || a.action;
                const who = a.user ? `${a.user.firstName} ${a.user.lastName}` : 'Sistem';
                return (
                  <div key={a.id} className="audit-item">
                    <span className="audit-action">{action}</span>
                    <span style={{ color: '#6b7280' }}> · {who}</span>
                    <div className="audit-meta">{new Date(a.createdAt).toLocaleString('tr-TR')}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Altbilgi */}
        <div className="footer">
          <div>
            <div className="left">MKÜ Teknoloji Transfer Ofisi · Proje Yönetim Sistemi</div>
            <div>Belge No: TTO-{project.id?.slice(0, 8).toUpperCase()} · Hatay Mustafa Kemal Üniversitesi</div>
          </div>
          <div className="gen" style={{ textAlign: 'right' }}>
            Oluşturma: {new Date().toLocaleString('tr-TR')}<br />
            Bu belge resmi proje arşivi içindir.
          </div>
        </div>
      </div>
    </>
  );
}
