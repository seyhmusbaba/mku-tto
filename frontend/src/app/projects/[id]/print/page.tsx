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
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    // sessionStorage'dan token al (ana sayfadan kopyalandı)
    const token = sessionStorage.getItem('tto_print_token') || localStorage.getItem('tto_token') || '';
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios.get(`${base}/projects/${id}`, { headers }).then(r => setProject(r.data)),
      axios.get(`${base}/projects/${id}/reports`, { headers }).then(r => setReports(r.data)).catch(() => {}),
      axios.get(`${base}/scopus/project/${id}/linked-publications`, { headers }).then(r => setLinkedPubs(r.data || [])).catch(() => {}),
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
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: white; color: #1a1a1a; font-size: 11pt; line-height: 1.5; }
        
        .page { max-width: 210mm; margin: 0 auto; padding: 12mm 14mm; }
        
        /* Üst başlık */
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f2444; padding-bottom: 10px; margin-bottom: 18px; }
        .header-left h1 { font-size: 16pt; font-weight: 700; color: #0f2444; margin-bottom: 3px; }
        .header-left p { font-size: 9pt; color: #6b7280; }
        .header-right { text-align: right; }
        .header-right .status { display: inline-block; padding: 4px 12px; border-radius: 99px; font-size: 9pt; font-weight: 600; color: white; }
        .header-right .date { font-size: 8.5pt; color: #9ca3af; margin-top: 5px; }
        .mku-logo { font-size: 9pt; font-weight: 700; color: #0f2444; margin-bottom: 4px; }
        
        /* Section başlıkları */
        .section { margin-bottom: 18px; }
        .section-title { font-size: 10pt; font-weight: 700; color: #0f2444; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 10px; }
        
        /* Info grid */
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
        .info-item { display: flex; flex-direction: column; }
        .info-label { font-size: 8pt; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
        .info-value { font-size: 10pt; color: #1a1a1a; font-weight: 500; margin-top: 1px; }
        
        /* Bütçe kutuları */
        .budget-box { display: inline-block; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 8px 14px; margin-right: 8px; margin-bottom: 6px; }
        .budget-box .label { font-size: 8pt; color: #0284c7; }
        .budget-box .value { font-size: 12pt; font-weight: 700; color: #0369a1; }
        
        /* Progress bar */
        .progress-wrap { margin: 10px 0; }
        .progress-label { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 9pt; }
        .progress-track { height: 10px; background: #f0ede8; border-radius: 99px; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, #0f2444, #1a3a6b); }
        
        /* Üyeler */
        .members-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .member-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; }
        .member-name { font-size: 9.5pt; font-weight: 600; color: #0f2444; }
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
        
        /* Altbilgi */
        .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 8pt; color: #9ca3af; }
        
        /* Baskı ayarları */
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page { padding: 8mm 10mm; }
          .no-print { display: none !important; }
          .report-item { break-inside: avoid; }
          @page { size: A4; margin: 8mm 10mm; }
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

        {/* Başlık */}
        <div className="header">
          <div className="header-left">
            <div className="mku-logo">MKÜ Teknoloji Transfer Ofisi</div>
            <h1>{project.title}</h1>
            <p>{getProjectTypeLabel(project.type)}{project.faculty ? ` · ${project.faculty}` : ''}</p>
          </div>
          <div className="header-right">
            <div className="status" style={{ background: sc }}>{PROJECT_STATUS_LABELS[project.status]}</div>
            <div className="date">Rapor tarihi: {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
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

        {/* Bütçe */}
        {project.budget && (
          <div className="section">
            <div className="section-title">Bütçe</div>
            <div>
              <div className="budget-box">
                <div className="label">Toplam Bütçe</div>
                <div className="value">{formatCurrency(project.budget)}</div>
              </div>
              {latestProgress > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div className="progress-wrap">
                    <div className="progress-label">
                      <span style={{ fontWeight: 600, color: '#0f2444' }}>Son Bildirilen İlerleme</span>
                      <span style={{ fontWeight: 700, color: '#0f2444' }}>%{latestProgress}</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${latestProgress}%` }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ekip */}
        {project.members && project.members.length > 0 && (
          <div className="section">
            <div className="section-title">Proje Ekibi ({project.members.length + 1} kişi)</div>
            <div className="members-grid">
              {/* Yürütücü */}
              <div className="member-card" style={{ borderColor: '#c8a45a', background: '#fffbeb' }}>
                <div className="member-name">{project.owner?.title} {project.owner?.firstName} {project.owner?.lastName}</div>
                <div className="member-role" style={{ color: '#92651a' }}>Yürütücü</div>
              </div>
              {project.members.map(m => (
                <div key={m.id} className="member-card">
                  <div className="member-name">{m.user?.title} {m.user?.firstName} {m.user?.lastName}</div>
                  <div className="member-role">{m.role === 'researcher' ? 'Araştırmacı' : m.role === 'advisor' ? 'Danışman' : m.role === 'assistant' ? 'Asistan' : m.role}</div>
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
                <span className="info-value">{{ none: 'Yok', pending: 'Basvuru Asamasinda', registered: 'Tescilli', published: 'Yayimlandi' }[(project as any).ipStatus as string] || (project as any).ipStatus}</span>
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
            <div className="section-title">Proje Çıktıları — Scopus Yayınları ({linkedPubs.length})</div>
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

        {/* Altbilgi */}
        <div className="footer">
          <span>MKÜ Teknoloji Transfer Ofisi · Proje Yönetim Sistemi</span>
          <span>Olusturma: {new Date().toLocaleString('tr-TR')}</span>
        </div>
      </div>
    </>
  );
}
