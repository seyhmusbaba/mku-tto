'use client';
/**
 * Proje Detay - Raporlar tab.
 * Yeniden tasarlandi: filtre chip'leri, kompakt ozet, sparkline trend,
 * her rapor turune ozel renk + sade kart - eski "saçma" progress bar yok.
 */
import { useState, useMemo } from 'react';
import { ReportTemplateDownloader } from './ReportTemplateDownloader';
import { formatDate, formatCurrency } from '@/lib/utils';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';

interface Props {
  project: any;
  reports: any[];
  reportTypes: any[];
  reportChartData: { date: string; progress: number }[];
  latestProgress: number;
  canEdit: boolean;
  myMembership: boolean;
  onAddReport: () => void;
  onEditReport: (r: any) => void;
  onDeleteReport: (id: string) => void;
}

const TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  progress:  { label: 'İlerleme',     color: '#1a3a6b', icon: '📊' },
  milestone: { label: 'Kilometre',    color: '#92651a', icon: '🎯' },
  financial: { label: 'Finansal',     color: '#059669', icon: '💰' },
  technical: { label: 'Teknik',       color: '#7c3aed', icon: '🔬' },
  risk:      { label: 'Risk',         color: '#dc2626', icon: '⚠️' },
  final:     { label: 'Final',        color: '#0891b2', icon: '🏁' },
};

const PROB_LABELS: Record<string, string> = { low: 'Düşük', medium: 'Orta', high: 'Yüksek', very_high: 'Çok Yüksek' };
const IMPACT_LABELS: Record<string, string> = { low: 'Düşük', medium: 'Orta', high: 'Yüksek', critical: 'Kritik' };
const RISK_STATUS: Record<string, { label: string; color: string }> = {
  open:       { label: 'Açık',       color: '#dc2626' },
  monitoring: { label: 'İzleniyor',  color: '#d97706' },
  mitigated:  { label: 'Azaltıldı',  color: '#059669' },
  closed:     { label: 'Kapatıldı',  color: '#6b7280' },
};
const MILE_STATUS: Record<string, { label: string; color: string }> = {
  achieved:  { label: 'Başarıldı', color: '#059669' },
  planned:   { label: 'Planlandı', color: '#1a3a6b' },
  delayed:   { label: 'Ertelendi', color: '#d97706' },
  cancelled: { label: 'İptal',     color: '#dc2626' },
};

export function ReportsTabSection({
  project, reports, reportChartData, latestProgress,
  canEdit, myMembership, onAddReport, onEditReport, onDeleteReport,
}: Props) {
  const [filter, setFilter] = useState<string>('all');

  // Filter cipi sayisi
  const typeCounts = useMemo(() => {
    const c: Record<string, number> = { all: reports.length };
    for (const r of reports) c[r.type] = (c[r.type] || 0) + 1;
    return c;
  }, [reports]);

  const filtered = useMemo(() => {
    if (filter === 'all') return reports;
    return reports.filter(r => r.type === filter);
  }, [reports, filter]);

  // Ust ozet sayilari
  const stats = useMemo(() => {
    const reporterIds = new Set(reports.map(r => r.author?.id).filter(Boolean));
    const lastDate = reports[0]?.createdAt;
    const firstDate = reports[reports.length - 1]?.createdAt;
    return {
      total: reports.length,
      reporters: reporterIds.size,
      lastDate,
      firstDate,
      progressTrend: latestProgress,
    };
  }, [reports, latestProgress]);

  return (
    <div className="space-y-5">
      {/* Ust bar: ozet + butonlar */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display text-lg font-bold text-navy">Raporlar</h3>
          <p className="text-xs text-muted mt-0.5">
            {reports.length === 0 ? 'Henüz rapor yok' :
              `${reports.length} rapor · ${stats.reporters} kişi · son güncelleme ${stats.lastDate ? formatDate(stats.lastDate) : '-'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ReportTemplateDownloader projectTitle={project.title} />
          {(canEdit || myMembership) && (
            <button onClick={onAddReport} className="btn-primary text-sm inline-flex items-center gap-1.5">
              <span>+</span> Rapor Ekle
            </button>
          )}
        </div>
      </div>

      {/* Ozet kartlari + Trend - 4 kompakt + 1 grafik */}
      {reports.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Sol: 4 kompakt stat */}
          <div className="lg:col-span-1 grid grid-cols-2 gap-3">
            <SummaryCard label="Toplam Rapor" value={stats.total} accent="#1a3a6b" />
            <SummaryCard
              label="Son İlerleme"
              value={latestProgress > 0 ? `%${latestProgress}` : '-'}
              accent={latestProgress >= 75 ? '#059669' : latestProgress >= 50 ? '#d97706' : '#1a3a6b'}
            />
            <SummaryCard label="Raporlayan" value={stats.reporters} accent="#c8a45a" />
            <SummaryCard
              label="İlk Rapor"
              value={stats.firstDate ? new Date(stats.firstDate).toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' }) : '-'}
              accent="#7c3aed"
              small
            />
          </div>

          {/* Sag: trend grafigi - sadece anlamli veri varsa */}
          {reportChartData.length > 1 ? (
            <div className="lg:col-span-2 card p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-display text-sm font-semibold text-navy">İlerleme Trendi</h4>
                <span className="text-[10px] text-muted">Son {reportChartData.length} rapor</span>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={reportChartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e8e4dc', fontSize: 11 }}
                    formatter={(v: any) => [`%${v}`, 'İlerleme']}
                  />
                  <Line type="monotone" dataKey="progress" stroke="#1a3a6b" strokeWidth={2.5}
                    dot={{ fill: '#1a3a6b', r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="lg:col-span-2 card p-4 flex items-center justify-center text-center" style={{ minHeight: 160 }}>
              <div>
                <p className="text-sm text-muted">İlerleme grafiği için en az 2 ilerleme raporu gerekli</p>
                <p className="text-xs text-muted mt-1">Şu an {reportChartData.length} ilerleme raporu var</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filtre cipleri - tur bazli */}
      {reports.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <FilterChip
            active={filter === 'all'} onClick={() => setFilter('all')}
            label="Tümü" count={typeCounts.all} color="#0f2444" />
          {Object.entries(TYPE_META).map(([key, meta]) => (
            typeCounts[key] > 0 && (
              <FilterChip
                key={key}
                active={filter === key} onClick={() => setFilter(key)}
                label={`${meta.icon} ${meta.label}`} count={typeCounts[key] || 0} color={meta.color} />
            )
          ))}
        </div>
      )}

      {/* Rapor listesi */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="w-7 h-7 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm">
            {filter === 'all' ? 'Henüz rapor eklenmemiş' : `Bu türde rapor yok`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r, idx) => (
            <ReportCard
              key={r.id}
              report={r}
              indexBadge={reports.length - reports.indexOf(r)}
              canEdit={canEdit}
              onEdit={() => onEditReport(r)}
              onDelete={() => onDeleteReport(r.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Summary card - kompakt sayisal kutu ─── */
function SummaryCard({ label, value, accent, small = false }: { label: string; value: any; accent: string; small?: boolean }) {
  return (
    <div className="card py-3 px-3 border-l-2" style={{ borderLeftColor: accent }}>
      <p className="text-[10px] uppercase tracking-wider text-muted font-bold">{label}</p>
      <p className={`font-display font-bold mt-0.5 ${small ? 'text-base' : 'text-2xl'}`} style={{ color: accent }}>{value}</p>
    </div>
  );
}

/* ─── Filtre chip ─── */
function FilterChip({ active, onClick, label, count, color }:
  { active: boolean; onClick: () => void; label: string; count: number; color: string }) {
  return (
    <button onClick={onClick}
      className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all inline-flex items-center gap-1.5"
      style={{
        background: active ? color : 'white',
        color:      active ? 'white' : color,
        border:     `1px solid ${active ? color : color + '44'}`,
      }}>
      {label}
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
        style={{ background: active ? 'rgba(255,255,255,0.25)' : color + '15' }}>
        {count}
      </span>
    </button>
  );
}

/* ─── Tek rapor karti - sade, okunakli ─── */
function ReportCard({ report: r, indexBadge, canEdit, onEdit, onDelete }: {
  report: any; indexBadge: number; canEdit: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const meta = (() => { try { return JSON.parse(r.metadata || '{}'); } catch { return {}; } })();
  const tm = TYPE_META[r.type] || { label: r.type, color: '#6b7280', icon: '📄' };
  const hasMeta = meta && Object.keys(meta).length > 0;

  return (
    <div className="card p-4" style={{ borderLeft: `3px solid ${tm.color}` }}>
      {/* Ust satir: # + tur chip + baslik + tarih + buton */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-[10px] font-bold text-muted mt-1 flex-shrink-0">#{indexBadge}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                style={{ background: tm.color + '18', color: tm.color }}>
                <span>{tm.icon}</span>{tm.label}
              </span>
              {r.type === 'progress' && r.progressPercent > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: r.progressPercent >= 75 ? '#dcfce7' : r.progressPercent >= 50 ? '#fef3c7' : '#dbeafe',
                    color:      r.progressPercent >= 75 ? '#166534' : r.progressPercent >= 50 ? '#92400e' : '#1e40af',
                  }}>
                  %{r.progressPercent} ilerleme
                </span>
              )}
            </div>
            <h4 className="font-display font-semibold text-navy text-sm leading-snug">{r.title}</h4>
            <p className="text-[11px] text-muted mt-1">
              {r.author?.title ? `${r.author.title} ` : ''}
              {r.author?.firstName} {r.author?.lastName}
              {' · '}{formatDate(r.createdAt)}
            </p>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={onEdit} className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: '#f0ede8', color: '#6b7280' }} aria-label="Düzenle">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button onClick={onDelete} className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: '#fff0f0', color: '#dc2626' }} aria-label="Sil">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Icerik */}
      {r.content && (
        <p className="text-sm text-slate-700 leading-relaxed mt-3 whitespace-pre-line">{r.content}</p>
      )}

      {/* Tur bazli metadata - sade */}
      {hasMeta && <ReportMetadata type={r.type} meta={meta} />}
    </div>
  );
}

function ReportMetadata({ type, meta }: { type: string; meta: any }) {
  if (type === 'progress') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
        {meta.nextSteps && <MetaBox label="Sonraki Adımlar" value={meta.nextSteps} tone="green" />}
        {meta.challenges && <MetaBox label="Zorluklar" value={meta.challenges} tone="amber" />}
      </div>
    );
  }
  if (type === 'milestone') {
    return (
      <div className="flex flex-wrap gap-1.5 mt-3">
        {meta.status && <Chip label={MILE_STATUS[meta.status]?.label || meta.status} color={MILE_STATUS[meta.status]?.color || '#6b7280'} />}
        {meta.plannedDate && <Chip label={`📅 Plan: ${new Date(meta.plannedDate).toLocaleDateString('tr-TR')}`} color="#6b7280" />}
        {meta.actualDate && <Chip label={`✅ Gerçek: ${new Date(meta.actualDate).toLocaleDateString('tr-TR')}`} color="#059669" />}
        {meta.impact && <Chip label={`Etki: ${IMPACT_LABELS[meta.impact] || meta.impact}`} color="#7c3aed" />}
        {meta.responsible && <Chip label={`👤 ${meta.responsible}`} color="#6b7280" />}
      </div>
    );
  }
  if (type === 'financial') {
    const total = +meta.totalBudget || 0;
    const spent = +meta.cumulativeSpent || 0;
    const ratio = total > 0 ? Math.min(100, (spent / total) * 100) : 0;
    return (
      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {meta.totalBudget && <MoneyBox label="Toplam" value={formatCurrency(+meta.totalBudget)} tone="blue" />}
          {meta.spent && <MoneyBox label="Bu Dönem" value={formatCurrency(+meta.spent)} tone="amber" />}
          {meta.cumulativeSpent && <MoneyBox label="Kümülatif" value={formatCurrency(+meta.cumulativeSpent)} tone="red" />}
          {meta.remaining && <MoneyBox label="Kalan" value={formatCurrency(+meta.remaining)} tone="green" />}
        </div>
        {total > 0 && (
          <div>
            <div className="flex justify-between text-[10px] text-muted mb-1">
              <span>Bütçe kullanımı</span>
              <span className="font-semibold text-navy">%{ratio.toFixed(0)}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f0ede8' }}>
              <div className="h-full rounded-full" style={{
                width: `${ratio}%`,
                background: ratio > 90 ? '#dc2626' : ratio > 70 ? '#d97706' : '#059669',
              }} />
            </div>
          </div>
        )}
        {meta.period && <p className="text-[11px] text-muted">📆 {meta.period}</p>}
      </div>
    );
  }
  if (type === 'technical') {
    return (
      <div className="mt-3 space-y-2 text-xs">
        {meta.topic && <p><span className="font-semibold text-navy">Konu:</span> <span className="text-slate-700">{meta.topic}</span></p>}
        {meta.methodology && <p><span className="font-semibold text-navy">Yöntem:</span> <span className="text-slate-700">{meta.methodology}</span></p>}
        {meta.conclusions && <MetaBox label="Sonuçlar" value={meta.conclusions} tone="purple" />}
        {meta.recommendations && <p><span className="font-semibold text-navy">Öneriler:</span> <span className="text-slate-700">{meta.recommendations}</span></p>}
      </div>
    );
  }
  if (type === 'risk') {
    return (
      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {meta.probability && <Chip label={`Olasılık: ${PROB_LABELS[meta.probability] || meta.probability}`} color="#dc2626" />}
          {meta.impact && <Chip label={`Etki: ${IMPACT_LABELS[meta.impact] || meta.impact}`} color="#ea580c" />}
          {meta.category && <Chip label={meta.category} color="#6b7280" />}
          {meta.riskStatus && <Chip label={RISK_STATUS[meta.riskStatus]?.label || meta.riskStatus} color={RISK_STATUS[meta.riskStatus]?.color || '#6b7280'} />}
        </div>
        {meta.mitigation && <MetaBox label="Önlem" value={meta.mitigation} tone="green" />}
        {meta.contingency && <MetaBox label="Acil Plan" value={meta.contingency} tone="amber" />}
        {meta.owner && <p className="text-xs text-muted">👤 Sorumlu: <span className="font-semibold text-navy">{meta.owner}</span></p>}
      </div>
    );
  }
  if (type === 'final') {
    const EVAL: Record<string, string> = { excellent: 'Mükemmel', good: 'İyi', average: 'Orta', below: 'Beklentinin Altı' };
    return (
      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {meta.evaluation && <Chip label={`🌟 ${EVAL[meta.evaluation] || meta.evaluation}`} color="#92651a" />}
          {meta.publications && meta.publications !== 'no' && <Chip label={`📄 ${meta.publications}`} color="#1d4ed8" />}
          {meta.sustainability && <Chip label={`♻️ ${meta.sustainability}`} color="#059669" />}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {meta.achievements && <MetaBox label="Başarılar" value={meta.achievements} tone="green" />}
          {meta.lessons && <MetaBox label="Öğrenilen Dersler" value={meta.lessons} tone="blue" />}
          {meta.recommendations && <MetaBox label="Öneriler" value={meta.recommendations} tone="purple" />}
          {meta.openItems && <MetaBox label="Açık Maddeler" value={meta.openItems} tone="amber" />}
        </div>
      </div>
    );
  }
  return null;
}

function MetaBox({ label, value, tone }: { label: string; value: string; tone: 'green' | 'amber' | 'blue' | 'purple' | 'red' }) {
  const palette: Record<string, { bg: string; border: string; text: string }> = {
    green:  { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
    amber:  { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    blue:   { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
    purple: { bg: '#faf5ff', border: '#ede9fe', text: '#6d28d9' },
    red:    { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
  };
  const p = palette[tone];
  return (
    <div className="p-2.5 rounded-lg" style={{ background: p.bg, border: `1px solid ${p.border}` }}>
      <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: p.text }}>{label}</p>
      <p className="text-xs leading-relaxed" style={{ color: p.text }}>{value}</p>
    </div>
  );
}

function MoneyBox({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'amber' | 'red' | 'green' }) {
  const palette: Record<string, { bg: string; border: string; text: string }> = {
    blue:  { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
    amber: { bg: '#fef3c7', border: '#fde68a', text: '#92400e' },
    red:   { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c' },
    green: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  };
  const p = palette[tone];
  return (
    <div className="p-2.5 rounded-lg text-center" style={{ background: p.bg, border: `1px solid ${p.border}` }}>
      <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: p.text }}>{label}</p>
      <p className="font-display text-sm font-bold mt-0.5" style={{ color: p.text }}>{value}</p>
    </div>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
      style={{ background: color + '15', color, border: `1px solid ${color}33` }}>
      {label}
    </span>
  );
}
